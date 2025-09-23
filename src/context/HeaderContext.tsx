import { createContext, useContext, useState, ReactNode } from 'react';

type HeaderState = {
  isProjectTitleInView: boolean;
  projectName: string | null;
};

type HeaderContextType = {
  headerState: HeaderState;
  setHeaderState: (state: HeaderState) => void;
};

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export const HeaderProvider = ({ children }: { children: ReactNode }) => {
  const [headerState, setHeaderState] = useState<HeaderState>({
    isProjectTitleInView: true,
    projectName: null,
  });

  return (
    <HeaderContext.Provider value={{ headerState, setHeaderState }}>
      {children}
    </HeaderContext.Provider>
  );
};

export const useHeader = () => {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
};
