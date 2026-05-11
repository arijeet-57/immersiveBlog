import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import PlaceholderPanel from './_PlaceholderPanel';

export default function ChroniclePost() {
  const { slug } = useParams();
  return (
    <>
      <Helmet>
        <title>{slug ?? 'Post'} · Chronicles</title>
        <meta name="description" content={`Chronicle: ${slug ?? ''}`} />
      </Helmet>
      <PlaceholderPanel title={slug ?? 'Untitled'}>
        MDX content lands in Part 9.
      </PlaceholderPanel>
    </>
  );
}
