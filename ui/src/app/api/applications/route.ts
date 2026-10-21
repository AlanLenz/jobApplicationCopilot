import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { encryptUserData, decryptUserData } from '@/lib/security';
import { getGeneratedDocument } from '@/lib/storage';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ applications: [] });
    }

    const rawApplications = await prisma.appliedJob.findMany({
      where: { userId: user.id },
      orderBy: { appliedAt: 'desc' },
    });

    const applications = rawApplications.map((app) => {
      let customResume = null;
      let coverLetter = null;

      if (app.encryptedCustomResume) {
        const decrypted = decryptUserData(app.encryptedCustomResume, user.id);
        if (decrypted) {
          try {
            customResume = JSON.parse(decrypted);
          } catch {
            customResume = { text: decrypted, html: `<pre>${decrypted}</pre>` };
          }
        }
      }

      if (app.encryptedCoverLetter) {
        const decrypted = decryptUserData(app.encryptedCoverLetter, user.id);
        if (decrypted) {
          try {
            coverLetter = JSON.parse(decrypted);
          } catch {
            coverLetter = { text: decrypted, html: `<pre>${decrypted}</pre>` };
          }
        }
      }

      return {
        id: app.id,
        jobId: app.jobId,
        title: app.title,
        company: app.company,
        url: app.url,
        description: app.description,
        atsScore: app.atsScore,
        appliedAt: app.appliedAt,
        hasResume: Boolean(customResume),
        hasCoverLetter: Boolean(coverLetter),
        customResume,
        coverLetter,
      };
    });

    return NextResponse.json({ applications });
  } catch (error: any) {
    console.error('Applications GET error:', error);
    return NextResponse.json({ error: 'Falha ao carregar histórico de vagas aplicadas.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Faça login ou crie sua conta para registrar vagas aplicadas no seu histórico.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { jobId } = body;

    let title = body.title;
    let company = body.company;
    let url = body.url;
    let description = body.description;
    let atsScore: number | null = body.atsScore ?? null;

    if (jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (job) {
        title = title || job.title;
        company = company || job.company;
        url = url || job.url;
        description = description || job.description;
        if (atsScore === null && job.matchScore) {
          atsScore = job.matchScore;
        }
      }
    }

    if (!title || !url) {
      return NextResponse.json({ error: 'Título e URL da vaga são obrigatórios.' }, { status: 400 });
    }

    // Check if there are generated documents for this job and encrypt them for this user
    let encryptedCustomResume: string | undefined;
    let encryptedCoverLetter: string | undefined;

    if (jobId) {
      const resumeDoc = getGeneratedDocument(`${user.id}_${jobId}`, 'resume') || getGeneratedDocument(jobId, 'resume');
      if (resumeDoc) {
        encryptedCustomResume = encryptUserData(JSON.stringify(resumeDoc), user.id);
      }
      const coverDoc = getGeneratedDocument(`${user.id}_${jobId}`, 'cover_letter') || getGeneratedDocument(jobId, 'cover_letter');
      if (coverDoc) {
        encryptedCoverLetter = encryptUserData(JSON.stringify(coverDoc), user.id);
      }
    }

    const appliedJob = await prisma.appliedJob.upsert({
      where: {
        userId_url: {
          userId: user.id,
          url: String(url),
        },
      },
      update: {
        title: String(title),
        company: company ? String(company) : null,
        description: description ? String(description) : null,
        ...(atsScore !== null ? { atsScore: Number(atsScore) } : {}),
        ...(encryptedCustomResume ? { encryptedCustomResume } : {}),
        ...(encryptedCoverLetter ? { encryptedCoverLetter } : {}),
        appliedAt: new Date(),
      },
      create: {
        userId: user.id,
        jobId: jobId ? String(jobId) : null,
        title: String(title),
        company: company ? String(company) : null,
        url: String(url),
        description: description ? String(description) : null,
        atsScore: atsScore !== null ? Number(atsScore) : null,
        encryptedCustomResume: encryptedCustomResume || null,
        encryptedCoverLetter: encryptedCoverLetter || null,
      },
    });

    // Update the job status in inbox to 'applied' so it leaves the pending list
    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'applied' },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      application: appliedJob,
    });
  } catch (error: any) {
    console.error('Applications POST error:', error);
    return NextResponse.json({ error: 'Falha ao registrar candidatura.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });
    }

    await prisma.appliedJob.deleteMany({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Applications DELETE error:', error);
    return NextResponse.json({ error: 'Falha ao remover candidatura do histórico.' }, { status: 500 });
  }
}
