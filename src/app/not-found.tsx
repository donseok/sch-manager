import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="text-2xl font-bold mb-4">페이지를 찾을 수 없습니다</h2>
      <p className="text-slate-600 dark:text-slate-400 mb-4">
        요청하신 페이지가 존재하지 않습니다.
      </p>
      <Link
        href="/dashboard"
        className="text-blue-600 hover:underline dark:text-blue-400"
      >
        대시보드로 돌아가기
      </Link>
    </div>
  );
}
