import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import { getBotConfigDoc } from '@/lib/admin/bot-configs';
import PageHeader from '../_components/PageHeader';
import CommandsClient from './CommandsClient';
import type { CommandsDoc } from './JesterTriggersPanel';
import type { AutoReplyDoc } from './AutoRepliesPanel';
import type { AutoImageRule } from './AutoImagesPanel';

export const dynamic = 'force-dynamic';

export default async function CommandsPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  const [jesterCmds, autoReply, autoImages] = await Promise.all([
    getBotConfigDoc('jester_commands'),
    getBotConfigDoc('butler_auto_reply'),
    getBotConfigDoc('butler_auto_images'),
  ]);

  const initial = {
    jester_commands:     (jesterCmds?.data ?? {}) as CommandsDoc,
    butler_auto_reply:   (autoReply?.data ?? { enabled: false, replies: [] }) as AutoReplyDoc,
    butler_auto_images:  Array.isArray(autoImages?.data) ? (autoImages!.data as AutoImageRule[]) : [],
  };

  return (
    <>
      <PageHeader
        title="Commands"
        subtitle="Here you control bot commands — trigger words, auto-replies, auto-images, and who can use each one."
      />
      <CommandsClient initial={initial} />
    </>
  );
}
