import { NextResponse } from 'next/server';
import { extractText, getDocumentProxy } from 'unpdf';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { encryptUserData, decryptUserData } from '@/lib/security';
import { resolveAIConfigForUser } from '@/lib/settings';
import { AIConfig, AIConfigError, generateText, providerSupportsPdf } from '@/lib/ai/client';
import { aiErrorResponse } from '@/lib/ai/http';
import { buildProfileExtractionPrompt } from '@/lib/ai/prompts';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
// Below this many characters we assume the PDF is scanned (images only, no text layer).
const MIN_PDF_TEXT_LENGTH = 200;

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
        const aiConfig = await resolveAIConfigForUser(user);
        extractedText = await extractProfileFromPdfInMemory(buffer, uploadType === 'linkedin', aiConfig);
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
  } catch (error) {
    console.error('Profile POST error:', error);
    return aiErrorResponse(error, 'Falha ao processar e criptografar as informações profissionais.');
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

/**
 * PDF -> profile text, entirely in memory.
 *
 * 1. The text layer is extracted locally (unpdf), so any model works, even text-only
 *    local models through Ollama/LM Studio.
 * 2. The configured LLM then rebuilds a clean, structured profile from that raw text.
 * 3. Scanned PDFs (no text layer) are sent as-is to providers that read PDFs natively
 *    (Gemini, Claude); for other providers the user gets a clear message.
 */
async function extractProfileFromPdfInMemory(
  buffer: Buffer,
  isLinkedInExport: boolean,
  aiConfig: AIConfig | null
): Promise<string> {
  let rawText = '';
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    rawText = (await extractText(pdf, { mergePages: true })).text.trim();
  } catch (error) {
    console.warn('Local PDF text extraction failed, falling back to the AI provider:', error);
  }

  if (rawText.length >= MIN_PDF_TEXT_LENGTH) {
    const structured = await generateText(aiConfig, {
      prompt: buildProfileExtractionPrompt(isLinkedInExport, rawText),
    });
    return structured.trim() || rawText;
  }

  if (aiConfig && !providerSupportsPdf(aiConfig)) {
    throw new AIConfigError(
      'Este PDF parece ser escaneado (sem texto selecionável) e o provedor de IA configurado não lê PDFs. Use Gemini ou Claude, envie um .txt/.md, ou cole o conteúdo no editor.'
    );
  }

  const structured = await generateText(aiConfig, {
    prompt: buildProfileExtractionPrompt(isLinkedInExport),
    pdfBase64: buffer.toString('base64'),
  });
  return structured.trim();
}
