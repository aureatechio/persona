import { redirect } from 'next/navigation';

/**
 * Legacy URL. The selfie-video flow moved from /selfie-video to
 * /selfie-video/{politician_slug} when multi-politician support shipped.
 * Anyone hitting the old URL (old QR codes, bookmarks, shared links)
 * lands on Flávio, which was the only politician served from this route
 * before the rollout.
 */
export default function SelfieVideoLegacyRoute() {
  redirect('/selfie-video/flavio');
}
