import { calculateChartWithAudit, buildLocalInterpretation } from '@/lib/ziwei/calculate';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chartInput = body.chart?.birthInfo ?? body.birthInfo ?? body;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastPrompt = [...messages].reverse().find((m: unknown) => {
      const msg = m as { role?: string; content?: string };
      return msg.role === 'user' && typeof msg.content === 'string';
    }) as { content?: string } | undefined;

    const result = calculateChartWithAudit(chartInput);
    const text = buildLocalInterpretation(result, lastPrompt?.content ?? '');
    return streamText(text);
  } catch (error) {
    return streamText(`**【解读失败】**\n${error instanceof Error ? error.message : '请求无法解析'}`);
  }
}

function streamText(text: string) {
  const encoder = new TextEncoder();
  const chunks = chunkText(text, 72);
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text: chunk } })}\n\n`));
        await new Promise(resolve => setTimeout(resolve, 8));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
