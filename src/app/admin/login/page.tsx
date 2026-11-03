export default function Login() {
  return (
    <section>
      <h1>관리자 로그인</h1>
      <p>
        별도로 발급받은 관리자 자격증명을 입력하세요. 세션은 15분 후 만료됩니다.
      </p>
      <form action="/api/admin/session" method="post">
        <label>
          관리자 토큰{" "}
          <input
            name="token"
            type="password"
            required
            autoComplete="off"
            minLength={32}
            maxLength={256}
          />
        </label>
        <button type="submit">로그인</button>
      </form>
    </section>
  );
}
