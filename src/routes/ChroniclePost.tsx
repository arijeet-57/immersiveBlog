import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { getPost } from '../content/posts';

const SITE = 'Ethereal Valley';

export default function ChroniclePost() {
  const { slug } = useParams();
  const post = getPost(slug);

  if (!post) {
    return (
      <Helmet>
        <title>Not found · {SITE}</title>
        <meta name="description" content="That chronicle could not be found." />
      </Helmet>
    );
  }

  const description = post.excerpt;
  return (
    <Helmet>
      <title>{post.title} · Chronicles · {SITE}</title>
      <meta name="description" content={description} />
      <meta property="og:type" content="article" />
      <meta property="og:title" content={`${post.title} · ${SITE}`} />
      <meta property="og:description" content={description} />
      <meta property="article:published_time" content={post.date} />
      <meta property="article:author" content={post.author} />
    </Helmet>
  );
}
