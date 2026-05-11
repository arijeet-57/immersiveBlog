import { Helmet } from 'react-helmet-async';
import PlaceholderPanel from './_PlaceholderPanel';

export default function Sanctuary() {
  return (
    <>
      <Helmet>
        <title>Sanctuary · Ethereal Valley</title>
        <meta name="description" content="Private journal." />
      </Helmet>
      <PlaceholderPanel title="Sanctuary">
        Private journal. Login form arrives in Part 7.
      </PlaceholderPanel>
    </>
  );
}
