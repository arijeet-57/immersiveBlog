import { Helmet } from 'react-helmet-async';
import PlaceholderPanel from './_PlaceholderPanel';

export default function ChroniclesIndex() {
  return (
    <>
      <Helmet>
        <title>Chronicles · Ethereal Valley</title>
        <meta name="description" content="Index of valley chronicles." />
      </Helmet>
      <PlaceholderPanel title="Chronicles">
        Index of posts. Real list arrives in Part 9.
      </PlaceholderPanel>
    </>
  );
}
