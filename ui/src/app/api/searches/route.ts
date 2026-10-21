import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ searches: [] });
    }

    const searches = await prisma.searchHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ searches });
  } catch (error: any) {
    console.error('SearchHistory GET error:', error);
    return NextResponse.json({ error: 'Falha ao carregar histórico de buscas.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      roles = ['software_engineer'],
      seniority = 'all',
      location = 'Worldwide',
      workplaceType = 'all',
      timeRangeSeconds = 86400,
      booleanQuery = '',
      searchUrl = '',
    } = body;

    const record = await prisma.searchHistory.create({
      data: {
        userId: user.id,
        roles: Array.isArray(roles) && roles.length > 0 ? roles.map(String) : ['software_engineer'],
        seniority: String(seniority),
        location: String(location),
        workplaceType: String(workplaceType),
        timeRangeSeconds: Number(timeRangeSeconds) || 0,
        booleanQuery: String(booleanQuery),
        searchUrl: String(searchUrl),
      },
    });

    return NextResponse.json({ success: true, search: record });
  } catch (error: any) {
    console.error('SearchHistory POST error:', error);
    return NextResponse.json({ error: 'Falha ao registrar busca.' }, { status: 500 });
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

    if (id) {
      await prisma.searchHistory.deleteMany({
        where: { id, userId: user.id },
      });
    } else {
      await prisma.searchHistory.deleteMany({
        where: { userId: user.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('SearchHistory DELETE error:', error);
    return NextResponse.json({ error: 'Falha ao remover histórico de busca.' }, { status: 500 });
  }
}
