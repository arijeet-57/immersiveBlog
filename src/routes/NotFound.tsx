import { Helmet } from 'react-helmet-async';
import PlaceholderPanel from './_PlaceholderPanel';

export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>Lost · Ethereal Valley</title>
        <meta name="description" content="This path is lost in the valley." />
      </Helmet>
      <PlaceholderPanel title="Lost in the valley">
        This path does not exist. Return to the canopy.
      </PlaceholderPanel>
    </>
  );
}
