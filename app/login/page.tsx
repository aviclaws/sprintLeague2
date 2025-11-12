// app/login/page.tsx
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100 p-6">
      <form
        action="/api/auth/login"
        method="POST"
        className="w-full max-w-sm bg-gray-800 text-gray-100 p-6 rounded-xl shadow-lg border border-gray-700"
      >
        <h1 className="text-2xl font-bold mb-6 text-center">
          sprintLeague — Login
        </h1>

        <label className="block mb-2 text-sm font-semibold">Username</label>
        <input
          name="username"
          className="w-full mb-4 px-3 py-2 bg-gray-700 text-gray-100 border border-gray-600 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          placeholder="Enter username"
          required
        />

        <label className="block mb-2 text-sm font-semibold">Password</label>
        <input
          name="password"
          type="password"
          className="w-full mb-6 px-3 py-2 bg-gray-700 text-gray-100 border border-gray-600 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          placeholder="Enter password"
          required
        />

        <button
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded transition"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
