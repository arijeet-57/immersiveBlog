import { Helmet } from 'react-helmet-async';

export default function Whispers() {
  return (
    <Helmet>
      <title>Whispers · Ethereal Valley</title>
      <meta name="description" content="Public guestbook for the valley." />
    </Helmet>
  );
}
