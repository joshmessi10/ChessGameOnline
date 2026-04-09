import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import chessHero from '../components/chess.svg';

const LandingPage = () => {
  const navigate = useNavigate();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Normalize mouse position from -0.5 to 0.5
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fade-in" style={{ 
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 35%, #1a1a1a 0%, #000000 70%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative',
      color: '#ffffff'
    }}>
      
      {/* Hero Section */}
      <div style={{ 
        textAlign: 'center', 
        paddingTop: '8rem', 
        zIndex: 10, 
        maxWidth: '1000px',
        width: '100%'
      }}>
        <h1 style={{ 
          fontSize: '5.5rem', 
          lineHeight: '1.05',
          marginBottom: '2rem', 
          fontFamily: 'Playfair Display, serif',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.02em',
          textShadow: '0 10px 30px rgba(0,0,0,0.8)'
        }}>
          The Elite <br /> 
          Chess Experience.
        </h1>
        
        <p style={{ 
          color: '#888888', 
          fontSize: '20px', 
          fontWeight: 400, 
          marginBottom: '4rem',
          fontFamily: 'Inter, sans-serif',
          maxWidth: '600px',
          margin: '0 auto 4rem auto',
          lineHeight: '1.6',
          textShadow: '0 2px 10px rgba(0,0,0,0.5)'
        }}>
          Join a community of grandmasters and enthusiasts. 
          Advanced analysis, competitive play, and a sober, professional environment.
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
          <button 
            onClick={() => navigate('/register')}
            className="primary-btn" 
            style={{ 
              padding: '16px 44px', 
              fontSize: '16px', 
              borderRadius: '40px',
              backgroundColor: '#ffffff',
              color: '#000000',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer'
            }}
          >
             Join the Club
          </button>
          <button 
            onClick={() => navigate('/login')}
            className="secondary-btn" 
            style={{ 
              padding: '16px 44px', 
              fontSize: '16px', 
              borderRadius: '40px',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#ffffff',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Member Access
          </button>
        </div>
      </div>

      {/* Hero Graphic - Isometric Chessboard SVG (Interactive Backdrop) */}
      <div style={{ 
        position: 'absolute',
        bottom: '-5%',
        left: '50%',
        width: '100%', 
        maxWidth: '1200px',
        opacity: 0.25,
        zIndex: 1,
        display: 'flex',
        justifyContent: 'center',
        // Interactive transformation logic
        pointerEvents: 'none',
        transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
        transform: `
          translateX(-50%) 
          translate3d(${mousePos.x * 40}px, ${mousePos.y * 40}px, 0) 
          rotateX(${-mousePos.y * 8}deg) 
          rotateY(${mousePos.x * 8}deg)
          scale(1.1)
        `,
        perspective: '1000px'
      }}>
        <img 
          src={chessHero} 
          alt="" 
          style={{ 
            width: '100%', 
            height: 'auto',
            pointerEvents: 'none',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)'
          }} 
        />
      </div>

    </div>
  );
};

export default LandingPage;
