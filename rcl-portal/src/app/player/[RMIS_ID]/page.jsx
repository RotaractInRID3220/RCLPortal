'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPlayerByRMISId } from '@/services/playerService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import Image from 'next/image';

export default function PlayerLanyardPage({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const rmisId = unwrappedParams.RMIS_ID;
  
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const lanyardRef = useRef(null);

  useEffect(() => {
    if (rmisId) {
      loadPlayerData();
    }
  }, [rmisId]);

  // Fetches player data and generates QR code
  const loadPlayerData = async () => {
    try {
      setLoading(true);
      const data = await getPlayerByRMISId(rmisId);
      setPlayer(data);
      
      // Generate QR code for registration URL
      const registrationUrl = `${window.location.origin}/admin/dashboard/register/player/${rmisId}`;
      const qrUrl = await QRCode.toDataURL(registrationUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#121212',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      });
      setQrCodeUrl(qrUrl);
    } catch (error) {
      toast.error('Failed to load player data');
      router.push('/player');
    } finally {
      setLoading(false);
    }
  };

  // Downloads the lanyard card as PNG image
  const handleDownload = async () => {
    try {
      setDownloading(true);

      // Create a canvas to draw the lanyard
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size (portrait orientation for lanyard)
      const width = 800;
      const height = 1100;
      canvas.width = width;
      canvas.height = height;

      // Background gradient (cranberry to black)
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#9B1B3A'); // Cranberry
      gradient.addColorStop(1, '#121212'); // Black
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Add subtle pattern/texture
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
      }
      ctx.globalAlpha = 1;

      // Load and draw logo
      const logo = new window.Image();
      logo.crossOrigin = 'anonymous';
      logo.src = '/LogoWhite.png';
      
      await new Promise((resolve, reject) => {
        logo.onload = resolve;
        logo.onerror = reject;
      });

      // Draw logo at top
      const logoWidth = 180;
      const logoHeight = (logo.height / logo.width) * logoWidth;
      ctx.drawImage(logo, (width - logoWidth) / 2, 60, logoWidth, logoHeight);

      // White card background
      const cardY = logoHeight + 120;
      const cardHeight = 720;
      const cardPadding = 40;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      ctx.fillRect(cardPadding, cardY, width - (cardPadding * 2), cardHeight);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Draw QR code
      const qrImage = new window.Image();
      qrImage.src = qrCodeUrl;
      
      await new Promise((resolve, reject) => {
        qrImage.onload = resolve;
        qrImage.onerror = reject;
      });

      const qrSize = 400;
      const qrX = (width - qrSize) / 2;
      const qrY = cardY + 60;
      
      // QR code border
      ctx.fillStyle = '#9B1B3A';
      ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
      
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      // Player name
      ctx.fillStyle = '#121212';
      ctx.font = 'bold 48px Poppins, sans-serif';
      ctx.textAlign = 'center';
      const nameY = qrY + qrSize + 70;
      
      // Word wrap for long names
      const maxWidth = width - (cardPadding * 3);
      const words = (player.name || 'Unknown').split(' ');
      let line = '';
      let lineY = nameY;
      
      words.forEach((word, index) => {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && index > 0) {
          ctx.fillText(line.trim(), width / 2, lineY);
          line = word + ' ';
          lineY += 55;
        } else {
          line = testLine;
        }
      });
      ctx.fillText(line.trim(), width / 2, lineY);

      // Club name
      ctx.font = '28px Poppins, sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(player.clubs?.club_name || '-', width / 2, lineY + 50);

      // RMIS ID at bottom
      ctx.font = 'bold 32px Poppins, sans-serif';
      ctx.fillStyle = '#9B1B3A';
      ctx.fillText(`RMIS: ${player.RMIS_ID}`, width / 2, cardY + cardHeight - 40);

      // Footer text
      ctx.font = '24px Poppins, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Rotaract Championship League', width / 2, height - 60);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${player.name?.replace(/\s+/g, '_')}_Lanyard.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.success('Lanyard downloaded successfully');
        setDownloading(false);
      }, 'image/png', 1.0);

    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download lanyard');
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cranberry mx-auto mb-4" />
          <p className="text-muted-foreground">Loading player data...</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <Button
          onClick={() => router.push('/player')}
          variant="ghost"
          size="sm"
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Search
        </Button>

        {/* Responsive Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Lanyard Card - Left Column on Large Screens */}
          <div className="flex flex-col">
            <div 
              ref={lanyardRef}
              className="relative bg-gradient-to-b from-cranberry to-blackD rounded-2xl shadow-2xl overflow-hidden w-full max-w-md mx-auto lg:mx-0"
            >
              {/* Logo */}
              <div className="pt-8 pb-6 flex justify-center">
                <Image
                  src="/LogoWhite.png"
                  alt="RCL Logo"
                  width={120}
                  height={60}
                  className="object-contain"
                />
              </div>

              {/* White Card Section */}
              <div className="mx-4 mb-8 bg-white rounded-xl shadow-xl p-6">
                {/* QR Code */}
                <div className="bg-cranberry p-2 rounded-lg mb-6">
                  <div className="bg-white p-3 rounded">
                    {qrCodeUrl && (
                      <img
                        src={qrCodeUrl}
                        alt="QR Code"
                        className="w-full h-auto"
                      />
                    )}
                  </div>
                </div>

                {/* Player Name */}
                <h2 className="text-2xl md:text-3xl font-bold text-blackD text-center mb-2 break-words">
                  {player.name || 'Unknown'}
                </h2>

                {/* Club Name */}
                <p className="text-base text-gray-600 text-center mb-4">
                  {player.clubs?.club_name || '-'}
                </p>

                {/* RMIS ID */}
                <div className="text-center">
                  <span className="inline-block px-4 py-2 bg-cranberry/10 text-cranberry font-bold rounded-lg text-sm">
                    RMIS: {player.RMIS_ID}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="pb-6 text-center">
                <p className="text-white text-sm font-medium">
                  Rotaract Championship League
                </p>
              </div>
            </div>
          </div>

          {/* Info & Actions - Right Column on Large Screens */}
          <div className="flex flex-col justify-center space-y-6">
            {/* RMIS ID Display */}
            <Card className="p-6 bg-card border-border">
              <p className="text-sm text-muted-foreground mb-2">RMIS ID</p>
              <p className="text-2xl font-mono font-bold text-foreground">
                {player.RMIS_ID}
              </p>
            </Card>

            {/* Player Info */}
            <Card className="p-6 bg-card border-border">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Name</p>
                  <p className="text-lg font-semibold text-foreground">
                    {player.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Club</p>
                  <p className="text-base text-foreground">
                    {player.clubs?.club_name || '-'}
                  </p>
                  {player.clubs?.category && (
                    <p className="text-sm text-muted-foreground">
                      {player.clubs.category}
                    </p>
                  )}
                </div>
                {player.NIC && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">NIC</p>
                    <p className="text-base font-medium text-foreground">
                      {player.NIC}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Download Button */}
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full h-12 bg-cranberry hover:bg-cranberry/90 text-white font-semibold text-base shadow-lg hover:shadow-cranberry/20"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating Lanyard...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Download Lanyard
                </>
              )}
            </Button>

            {/* QR Info */}
            <div className="text-center lg:text-left">
              <p className="text-sm text-muted-foreground">
                Scan QR code to register player
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
