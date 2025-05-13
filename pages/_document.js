import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <title>EV Charging Finder</title>
        <meta name="description" content="Find the nearest electric vehicle charging stations. Search by address or click on the map!" />
        <link rel="icon" type="image/png" href="/images/logo.png" title="EV Charging Finder" description="Animated EV logo for the app favicon." />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
