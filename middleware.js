// Vercel Edge Middleware
// 사이트의 모든 페이지에 아이디/비밀번호 잠금을 겁니다.
// Vercel 프로젝트 설정 > Environment Variables 에서
// SITE_USER, SITE_PASS 값을 직접 정한 값으로 설정하세요.

export const config = {
  matcher: '/:path*',
};

export default function middleware(req) {
  try {
    const user = process.env.SITE_USER || 'admin';
    const pass = process.env.SITE_PASS || '';
    const auth = req.headers.get('authorization') || '';

    if (auth.startsWith('Basic ') && pass) {
      const encoded = auth.slice(6);
      const decoded = atob(encoded);
      const idx = decoded.indexOf(':');
      const u = idx >= 0 ? decoded.slice(0, idx) : '';
      const p = idx >= 0 ? decoded.slice(idx + 1) : '';
      if (u === user && p === pass) {
        return;
      }
    }
  } catch (e) {
    // 문제가 생겨도 아래로 내려가서 401 처리
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Restricted"' },
  });
}
