import { useAuthStore } from '@/stores/authStore.js';
import { userApi } from '@/services/endpoints.js';
import { OnboardingFlow } from './OnboardingFlow.jsx';

/**
 * Shows the first-run walkthrough for any signed-in user with no `onboardedAt`, marking it
 * complete server-side on finish. Driven entirely by `user.onboardedAt` — Settings' "Replay
 * onboarding" action nulls it server-side and this gate reappears on its own.
 */
export function OnboardingGate() {
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);

  if (!user || user.onboardedAt) return null;

  const finish = async () => {
    try {
      const updated = await userApi.completeOnboarding();
      patchUser(updated);
    } catch {
      // Server unreachable — don't trap the user behind the walkthrough forever; let them
      // in and this will simply reappear next load if the patch never actually landed.
      patchUser({ onboardedAt: new Date().toISOString() });
    }
  };

  return <OnboardingFlow onFinish={finish} persistKey={`onboarding-step-${user.id}`} />;
}
