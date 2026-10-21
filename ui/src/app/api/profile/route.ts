import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { encryptUserData, decryptUserData } from '@/lib/security';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const decryptedResume = decryptUserData(user.encryptedResume, user.id) || '';

    return NextResponse.json({
      hasResume: Boolean(decryptedResume),
      resumeText: decryptedResume,
      resumeSource: user.resumeSource,
      resumeUpdatedAt: user.resumeUpdatedAt,
      securityInfo: {
        encryption: 'AES-256-GCM',
        keyDerivation: 'HKDF-SHA256 (Chave exclusiva por usuário)',
        storage: 'Criptografado em repouso no banco de dados (Zero arquivos públicos em disco)',
      },
    });
  } catch (error: any) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Erro ao carregar perfil.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Faça login para salvar suas informações profissionais.' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';

    let extractedText = '';
    let sourceLabel = 'Edição Manual';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const uploadType = String(formData.get('uploadType') || 'resume'); // 'resume' | 'linkedin'

      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: 'O arquivo excede o tamanho máximo permitido de 10 MB.' },
          { status: 400 }
        );
      }

      const fileName = file.name || 'documento';
      const lowerName = fileName.toLowerCase();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.json') || lowerName.endsWith('.csv')) {
        extractedText = buffer.toString('utf-8').trim();
        sourceLabel = uploadType === 'linkedin' ? `LinkedIn (${fileName})` : `Currículo (${fileName})`;
      } else if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
        const base64Pdf = buffer.toString('base64');
        extractedText = await extractProfileFromPdfInMemory(base64Pdf, uploadType === 'linkedin');
        sourceLabel = uploadType === 'linkedin' ? `LinkedIn PDF (${fileName})` : `Currículo PDF (${fileName})`;
      } else {
        return NextResponse.json(
          { error: 'Formato não suportado. Envie um arquivo PDF (.pdf), Texto (.txt) ou Markdown (.md).' },
          { status: 400 }
        );
      }
    } else {
      const body = await request.json();
      extractedText = String(body.resumeText || '').trim();
      sourceLabel = String(body.source || 'Edição Manual');
    }

    if (!extractedText || extractedText.length < 20) {
      return NextResponse.json(
        { error: 'O conteúdo profissional fornecido é muito curto ou não pôde ser extraído.' },
        { status: 400 }
      );
    }

    // Encrypt with AES-256-GCM bound to this userId before saving to DB
    const encryptedResume = encryptUserData(extractedText, user.id);
    const now = new Date();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        encryptedResume,
        resumeSource: sourceLabel,
        resumeUpdatedAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      hasResume: true,
      resumeText: extractedText,
      resumeSource: sourceLabel,
      resumeUpdatedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error('Profile POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao processar e criptografar as informações profissionais.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        encryptedResume: null,
        resumeSource: null,
        resumeUpdatedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Suas informações profissionais foram permanentemente removidas.',
    });
  } catch (error: any) {
    console.error('Profile DELETE error:', error);
    return NextResponse.json({ error: 'Erro ao remover dados do perfil.' }, { status: 500 });
  }
}

async function extractProfileFromPdfInMemory(base64Pdf: string, isLinkedInExport: boolean): Promise<string> {
  const prompt = isLinkedInExport
    ? `Extract the complete professional profile from this LinkedIn PDF export.
Preserve ALL details faithfully: Full Name, Headline, Contact Info, Location, Summary/About, All Work Experiences (Company, Role, Dates, Location, Full Description & Achievements), Education, Certifications, Technical Skills, and Languages.
Do not invent or omit any information. Return clean, well-structured plain text / markdown suitable as a Master Resume Profile.`
    : `Extract the complete content of this Resume / CV PDF document.
Preserve ALL details faithfully: Full Name, Contact Info, Links (LinkedIn, GitHub, Portfolio), Professional Summary, All Work Experiences (Company, Role, Dates, Bullet points & Metrics), Education, Technical Skills, Certifications, Projects, and Languages.
Do not invent or omit any information. Return clean, well-structured plain text / markdown suitable as a Master Resume Profile.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf,
            },
          },
          { text: prompt },
        ],
      },
    ],
  });

  return (response.text || '').trim();
}
