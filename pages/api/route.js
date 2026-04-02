export async function GET() {
  return new Response(JSON.stringify({ message: 'Hello' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}