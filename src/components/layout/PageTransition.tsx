import { ReactNode, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    // Only transition if the path actually changed
    if (previousPathRef.current !== location.pathname) {
      previousPathRef.current = location.pathname;
      setIsTransitioning(true);
      
      const timeout = setTimeout(() => {
        setDisplayChildren(children);
        setIsTransitioning(false);
      }, 100);
      
      return () => clearTimeout(timeout);
    } else {
      // Same path, just update children without transition
      setDisplayChildren(children);
    }
  }, [location.pathname, children]);

  return (
    <div
      className={cn(
        'transition-all duration-200 ease-out',
        isTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
      )}
    >
      {displayChildren}
    </div>
  );
}
