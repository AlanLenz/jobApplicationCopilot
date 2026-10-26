import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import {
  SettingsValidationError,
  getUserSettings,
  toSettingsView,
  updateUserSettings,
} from '@/lib/settings';
import type { UserSettingsUpdate } from '@/lib/settings-types';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    const settings = await getUserSettings(user.id);
    return NextResponse.json(toSettingsView(user, settings));
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Erro ao carregar configurações.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    const body = (await request.json()) as UserSettingsUpdate;
    const settings = await updateUserSettings(user.id, body);
    return NextResponse.json(toSettingsView(user, settings));
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Erro ao salvar configurações.' }, { status: 500 });
  }
}

/** Restores every setting (including the saved API key) to the defaults. */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    await prisma.userSettings.deleteMany({ where: { userId: user.id } });
    return NextResponse.json(toSettingsView(user, null));
  } catch (error) {
    console.error('Settings DELETE error:', error);
    return NextResponse.json({ error: 'Erro ao restaurar configurações.' }, { status: 500 });
  }
}
