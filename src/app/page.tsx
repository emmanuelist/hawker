// M0 hello-world. Replaced by the seller board in M1; carries no product claims until they are verified.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col justify-center gap-3 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Hawker</h1>
      <p className="text-base leading-7 opacity-80">
        A live-sale desk built on PayPal. In development for the PayPal AI Hackathon.
      </p>
      <p className="text-sm opacity-60">
        Service health: <a className="underline" href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
