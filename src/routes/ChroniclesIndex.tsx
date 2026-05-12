import { Helmet } from 'react-helmet-async';
import { posts } from '../content/posts';

const SITE = 'Ethereal Valley';

export default function ChroniclesIndex() {
  const description = `Field notes from the valley — ${posts.length} chronicles, latest: "${posts[0]?.title ?? ''}".`;
  return (
    <Helmet>
      <title>Chronicles · {SITE}</title>
      <meta name="description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={`Chronicles · ${SITE}`} />
      <meta property="og:description" content={description} />
    </Helmet>
  );
}
