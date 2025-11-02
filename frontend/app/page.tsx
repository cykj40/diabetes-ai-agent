import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <nav className="flex justify-between items-center mb-16">
          <div className="text-2xl font-bold text-blue-600">DiabetesAI</div>
          <div className="space-x-4">
            <Link
              href="/signin"
              className="text-blue-600 hover:text-blue-800"
            >
              Sign In
            </Link>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6 text-gray-900">
            Your Personal Diabetes Assistant
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Manage your diabetes with AI-powered insights, real-time monitoring,
            and personalized recommendations.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg 
                     text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <FeatureCard
            title="Smart Monitoring"
            description="Track your glucose levels with AI-powered insights and predictions"
          />
          <FeatureCard
            title="Personalized Advice"
            description="Get tailored recommendations based on your health data"
          />
          <FeatureCard
            title="Easy Management"
            description="Simplify your diabetes care with our intuitive tools"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h3 className="text-xl font-semibold mb-3 text-gray-900">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
