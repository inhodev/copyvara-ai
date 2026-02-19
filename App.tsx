import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './store';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { DocumentDetail } from './pages/DocumentDetail';
import { GraphPage } from './pages/GraphPage';
import { Ask } from './pages/Ask';
import { SearchPage } from './pages/SearchPage';
import { Settings } from './pages/Settings';

const App: React.FC = () => {
  return (
    <AppProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/doc/:id" element={<DocumentDetail />} />
            <Route path="/graph" element={<GraphPage />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AppProvider>
  );
};

export default App;