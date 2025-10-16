export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Office Attendance Tracker API</h1>
      <p className="text-lg text-gray-600">Backend server is running</p>
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">API available at:</p>
        <code className="bg-gray-100 px-3 py-1 rounded mt-2 inline-block">/api/*</code>
      </div>
    </div>
  );
}
