import ChatInterface from '../components/ChatInterface';
import { usePeriods } from '../hooks/usePeriods';
import { MessageSquare } from 'lucide-react';

export default function Coach() {
  const { activePeriod } = usePeriods();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <MessageSquare className="w-8 h-8 text-blue-500 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Coach</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300">
          Get personalized coaching powered by AI. Reflect on your progress, discuss challenges, and get actionable advice.
        </p>
        {activePeriod && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Coaching for: <span className="font-medium">{activePeriod.name}</span>
          </p>
        )}
      </div>

      <ChatInterface periodId={activePeriod?.id} />
    </div>
  );
}
