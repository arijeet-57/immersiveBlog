import { Helmet } from 'react-helmet-async';
import PlaceholderPanel from './_PlaceholderPanel';

export default function Whispers() {
  return (
    <>
      <Helmet>
        <title>Whispers · Ethereal Valley</title>
        <meta name="description" content="Public guestbook." />
      </Helmet>
      <PlaceholderPanel title="Whispers">
        Public guestbook. Content arrives in Part 7.
      </PlaceholderPanel>
    </>
  );
}
