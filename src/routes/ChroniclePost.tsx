import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';

export default function ChroniclePost() {
  const { slug } = useParams();
  return (
    <Helmet>
      <title>{slug ?? 'Post'} · Chronicles · Ethereal Valley</title>
      <meta name="description" content={`Chronicle: ${slug ?? ''}`} />
    </Helmet>
  );
}
