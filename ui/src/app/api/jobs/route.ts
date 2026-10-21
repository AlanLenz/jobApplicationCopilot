import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Clean up any legacy rejected jobs since rejected jobs should not be registered
    await prisma.job.deleteMany({
      where: { status: 'rejected' },
    }).catch(() => {});

    const jobs = await prisma.job.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Rejected jobs do not need to be registered — delete them immediately
    if (status === 'rejected') {
      await prisma.job.delete({
        where: { id },
      }).catch(() => {});
      return NextResponse.json({ id, deleted: true });
    }

    const updatedJob = await prisma.job.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updatedJob);
  } catch (error) {
    console.error('Failed to update job:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    await prisma.job.delete({
      where: { id },
    }).catch(() => {});

    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    console.error('Failed to delete job:', error);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
