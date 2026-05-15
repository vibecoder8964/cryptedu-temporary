import { useState, useEffect } from "react";
import { Network, Server, Wifi, ArrowRight, ShieldCheck, Database, Search, X, Minus, Plus } from "lucide-react";
import { useSettings } from "../lib/SettingsContext";
import masterHubImg from "../assets/masterhub.jpeg";
import subHubImg from "../assets/subhub.jpeg";

export default function HubArchitecturePage() {
  const { t, formatCurrency, hubRates } = useSettings();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => {
    setZoom(prev => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) setPosition({ x: 0, y: 0 });
      return newZoom;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxImage) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          handleZoomOut();
        }
      }
      
      if (e.key === 'Escape') {
        setLightboxImage(null);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage, zoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="p-8 max-w-5xl font-sans animate-in fade-in duration-300 relative z-10">
      <h2 className="text-[25px] font-bold mb-2 text-[#111111]">{t('nav_hub_architecture')}</h2>
      <p className="text-sm text-gray-600 mb-8">
        {t('hub_arch_subtitle')}
      </p>

      {/* Bucket Brigade Visualization */}
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm mb-8">
        <h3 className="text-lg font-bold text-[#111111] mb-6 flex items-center gap-2">
          <Network className="text-blue-600" size={20} />
          {t('bucket_brigade_flow')}
        </h3>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-6 bg-slate-50 rounded-lg border border-slate-200">
          
          <div className="flex flex-col items-center text-center w-full md:w-1/4">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3 border-4 border-white shadow-sm">
              <Database size={24} />
            </div>
            <h4 className="font-bold text-gray-800 text-sm">{t('aws_s3_bedrock')}</h4>
            <p className="text-xs text-gray-500 mt-1">{t('s3_source')}</p>
          </div>

          <ArrowRight className="hidden md:block text-slate-400 shrink-0" size={24} />

          <div className="flex flex-col items-center text-center w-full md:w-1/4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3 border-4 border-white shadow-sm">
              <Server size={24} />
            </div>
            <h4 className="font-bold text-gray-800 text-sm">{t('master_hub_label')}</h4>
            <p className="text-xs text-gray-500 mt-1">{t('master_hub_desc')}</p>
          </div>

          <ArrowRight className="hidden md:block text-slate-400 shrink-0" size={24} />

          <div className="flex flex-col items-center text-center w-full md:w-1/4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 border-4 border-white shadow-sm">
              <Wifi size={24} />
            </div>
            <h4 className="font-bold text-gray-800 text-sm">{t('sub_hub_label')}</h4>
            <p className="text-xs text-gray-500 mt-1">{t('subhub_desc')}</p>
          </div>

          <ArrowRight className="hidden md:block text-slate-400 shrink-0" size={24} />

          <div className="flex flex-col items-center text-center w-full md:w-1/4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3 border-4 border-white shadow-sm">
              <ShieldCheck size={24} />
            </div>
            <h4 className="font-bold text-gray-800 text-sm">{t('student_devices')}</h4>
            <p className="text-xs text-gray-500 mt-1">{t('student_desc')}</p>
          </div>

        </div>
      </div>

      {/* Technical Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-gray-200 pb-4">
        <h3 className="text-lg font-bold text-[#111111]">{t('hardware_specs_malaysia')}</h3>
      </div>

      <div className="space-y-8">
        
        {/* Master Hub */}
        <div className="bg-white rounded-xl border-t-4 border-t-red-500 border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
          <div className="w-full md:w-2/5 bg-gray-100 p-6 flex items-center justify-center border-r border-gray-200">
            <div 
              className="relative group cursor-pointer"
              onClick={() => setLightboxImage(masterHubImg)}
            >
              <img src={masterHubImg} alt="Master Hub Architecture" className="max-w-full h-auto rounded-lg shadow-sm border border-gray-300 transition-opacity group-hover:opacity-80" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-white/50 p-4 rounded-full backdrop-blur-sm">
                  <Search className="text-gray-900" size={32} />
                </div>
              </div>
            </div>
          </div>
          <div className="w-full md:w-3/5 p-6 md:p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h4 className="text-2xl font-bold text-gray-800">{t('master_hub_arch_title')}</h4>
                <p className="text-sm text-gray-500 mt-1">{t('master_hub_backbone')}</p>
              </div>
              <Server className="text-gray-300" size={36} />
            </div>
            
            <div className="space-y-4 mb-6">
              <h5 className="font-bold text-sm text-gray-700 uppercase tracking-wide">{t('component_breakdown')}</h5>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('computing_label')}</strong> Raspberry Pi 5 8GB + 2TB NVMe SSD</span>
                  <span className="font-bold text-gray-800">{formatCurrency(1800)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('radio_beam_label')}</strong> Ubiquiti AirFiber 5XHD + 30dBi Dish</span>
                  <span className="font-bold text-gray-800">{formatCurrency(3915)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('connectivity_label')}</strong> Starlink High-Performance Kit</span>
                  <span className="font-bold text-gray-800">{formatCurrency(11600)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('energy_label')}</strong> 1kW Solar + 5kWh LiFePO4 Battery</span>
                  <span className="font-bold text-gray-800">{formatCurrency(8500)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('structure_label')}</strong> 30m Lattice Tower + Foundation</span>
                  <span className="font-bold text-gray-800">{formatCurrency(28000)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('logistics_label')}</strong> Transport + Professional Installation</span>
                  <span className="font-bold text-gray-800">{formatCurrency(12000)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('security_label')}</strong> Lightning Protection + Fencing</span>
                  <span className="font-bold text-gray-800">{formatCurrency(3500)}</span>
                </li>
              </ul>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t-2 border-red-100">
              <span className="font-bold text-gray-800">{t('estimated_market_total')}</span>
              <span className="text-2xl font-bold text-red-600">{formatCurrency(71315)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 text-xs text-gray-500 italic">
              <span>{t('optimised_colocated')}</span>
              <span className="font-semibold text-red-500">{formatCurrency(38000)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 text-xs text-gray-500 italic">
              <span>{t('annual_maintenance')}</span>
              <span>{formatCurrency(hubRates.masterOpex)} / {t('year')}</span>
            </div>
          </div>
        </div>

        {/* Sub Hub */}
        <div className="bg-white rounded-xl border-t-4 border-t-blue-500 border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
          <div className="w-full md:w-2/5 bg-gray-100 p-6 flex items-center justify-center border-r border-gray-200">
            <div 
              className="relative group cursor-pointer"
              onClick={() => setLightboxImage(subHubImg)}
            >
              <img src={subHubImg} alt="Sub Hub Architecture" className="max-w-full h-auto rounded-lg shadow-sm border border-gray-300 transition-opacity group-hover:opacity-80" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-white/50 p-4 rounded-full backdrop-blur-sm">
                  <Search className="text-gray-900" size={32} />
                </div>
              </div>
            </div>
          </div>
          <div className="w-full md:w-3/5 p-6 md:p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h4 className="text-2xl font-bold text-gray-800">{t('sub_hub_arch_title')}</h4>
                <p className="text-sm text-gray-500 mt-1">{t('sub_hub_receiver')}</p>
              </div>
              <Wifi className="text-gray-300" size={36} />
            </div>
            
            <div className="space-y-4 mb-6">
              <h5 className="font-bold text-sm text-gray-700 uppercase tracking-wide">{t('component_breakdown')}</h5>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('computing_label')}</strong> Raspberry Pi 5 4GB + 512GB SSD</span>
                  <span className="font-bold text-gray-800">{formatCurrency(1100)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('receiver_label')}</strong> Ubiquiti PowerBeam 5AC-ISO</span>
                  <span className="font-bold text-gray-800">{formatCurrency(900)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('local_wifi_label')}</strong> 2x Industrial Outdoor Access Points</span>
                  <span className="font-bold text-gray-800">{formatCurrency(2400)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('energy_label')}</strong> 400W Solar + 2kWh Battery</span>
                  <span className="font-bold text-gray-800">{formatCurrency(3800)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('structure_label')}</strong> 12m Monopole + Reinforced Pole</span>
                  <span className="font-bold text-gray-800">{formatCurrency(4000)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('logistics_label')}</strong> Remote Area Installation Labour</span>
                  <span className="font-bold text-gray-800">{formatCurrency(6000)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="flex-1"><strong>{t('security_label')}</strong> Surge Protection + Lockable Rack</span>
                  <span className="font-bold text-gray-800">{formatCurrency(1000)}</span>
                </li>
              </ul>
            </div>

            <div className="flex justify-between items-center pt-4 border-t-2 border-blue-100">
              <span className="font-bold text-gray-800">{t('estimated_market_total')}</span>
              <span className="text-2xl font-bold text-blue-600">{formatCurrency(19200)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 text-xs text-gray-500 italic">
              <span>{t('optimised_smaller')}</span>
              <span className="font-semibold text-blue-500">{formatCurrency(14500)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 text-xs text-gray-500 italic">
              <span>{t('annual_maintenance')}</span>
              <span>{formatCurrency(hubRates.subOpex)} / {t('year')}</span>
            </div>
          </div>
        </div>
      </div>



      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-w-5xl w-full flex flex-col items-center">
            <div className="absolute -top-16 right-0 flex items-center gap-4">
              <div className="flex bg-white/10 rounded-lg p-1 border border-white/20">
                <button 
                  onClick={handleZoomOut} 
                  title="Zoom Out (Ctrl -)"
                  className="p-2 text-white hover:bg-white/10 rounded-md transition-colors"
                >
                  <Minus size={20}/>
                </button>
                <button 
                  onClick={handleZoomIn} 
                  title="Zoom In (Ctrl +)"
                  className="p-2 text-white hover:bg-white/10 rounded-md transition-colors"
                >
                  <Plus size={20}/>
                </button>
              </div>
              <button 
                onClick={() => {
                  setLightboxImage(null);
                  setZoom(1);
                  setPosition({ x: 0, y: 0 });
                }}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors flex items-center gap-2"
              >
                <span className="font-medium text-sm">{t('close')}</span>
                <X size={24} />
              </button>
            </div>
            <div 
              className={`overflow-hidden rounded-lg shadow-2xl border border-white/10 ${zoom > 1 ? 'cursor-move' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img 
                src={lightboxImage} 
                alt="Fullscreen Architecture" 
                className="max-w-full max-h-[85vh] object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                }}
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
