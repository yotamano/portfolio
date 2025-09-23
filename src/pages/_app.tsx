import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Layout from '../components/Layout';
import { PortfolioData, ContentItem } from '../types';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/router';
import { HeaderProvider } from '../context/HeaderContext';

function MyApp({ Component, pageProps }: AppProps<{ portfolioData: PortfolioData, content?: ContentItem }>) {
  const { portfolioData, content } = pageProps;
  const title = content?.name;
  const router = useRouter();

  return (
    <HeaderProvider>
      <Layout portfolioData={portfolioData} title={title}>
        <AnimatePresence mode="wait">
          <motion.div
            key={router.route}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Component {...pageProps} content={content} />
          </motion.div>
        </AnimatePresence>
      </Layout>
    </HeaderProvider>
  );
}

export default MyApp; 