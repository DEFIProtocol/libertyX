import { useState, useEffect } from 'react';
import Loader from '../components/Loader';

function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      setData({ message: "Loaded!" });
      setIsLoading(false);
    }, 2000);
  }, []);

  return (
    <div className="home">
      {isLoading ? (
        <Loader 
          isLoading={isLoading}
          message="Loading dashboard..."
          size="medium"
        />
      ) : (
        <div className="home-content">
          <h1>Welcome to LibertyX</h1>
          <p>Your data: {data.message}</p>
          {/* Your actual home content */}
        </div>
      )}
    </div>
  );
}

export default Home;