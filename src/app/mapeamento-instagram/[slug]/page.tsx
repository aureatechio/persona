import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function SlugRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/mapeamento-instagram?u=${encodeURIComponent(slug)}`);
}
