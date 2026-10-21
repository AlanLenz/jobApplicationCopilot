import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/security';
import { createUserSession, getCurrentUser, clearUserSession } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        hasResume: Boolean(user.encryptedResume),
        resumeSource: user.resumeSource,
        resumeUpdatedAt: user.resumeUpdatedAt,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Auth GET error:', error);
    return NextResponse.json({ authenticated: false, user: null }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, name, email, password } = body;

    if (action === 'logout') {
      await clearUserSession();
      return NextResponse.json({ success: true });
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json({ error: 'Informe um endereço de e-mail válido.' }, { status: 400 });
    }

    if (!password || String(password).length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }

    if (action === 'register') {
      const cleanName = String(name || '').trim();
      if (!cleanName) {
        return NextResponse.json({ error: 'Informe seu nome para o cadastro.' }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Já existe uma conta cadastrada com este e-mail.' },
          { status: 409 }
        );
      }

      const passwordHash = hashPassword(String(password));
      const user = await prisma.user.create({
        data: {
          name: cleanName,
          email: normalizedEmail,
          passwordHash,
        },
      });

      await createUserSession(user.id);

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          hasResume: false,
          resumeSource: null,
          resumeUpdatedAt: null,
          createdAt: user.createdAt,
        },
      });
    }

    if (action === 'login') {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user || !verifyPassword(String(password), user.passwordHash)) {
        return NextResponse.json(
          { error: 'E-mail ou senha inválidos.' },
          { status: 401 }
        );
      }

      await createUserSession(user.id);

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          hasResume: Boolean(user.encryptedResume),
          resumeSource: user.resumeSource,
          resumeUpdatedAt: user.resumeUpdatedAt,
          createdAt: user.createdAt,
        },
      });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error: any) {
    console.error('Auth POST error:', error);
    return NextResponse.json({ error: error.message || 'Falha na autenticação.' }, { status: 500 });
  }
}
