import { useState, useEffect } from "react";
import { UploadCloud, FileJson, Info, Map as MapIcon, Loader2, ShieldCheck } from "lucide-react";
import { useSettings } from "../lib/SettingsContext";

export default function HubPlacementPage() {
  const { t, formatCurrency } = useSettings();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const [mapHtml, setMapHtml] = useState<string | null>(null);

  useEffect(() => {
    const savedData = localStorage.getItem('slm_hub_resultData');
    const savedMap = localStorage.getItem('slm_hub_mapHtml');
    if (savedData && savedMap) {
      try {
        setResultData(JSON.parse(savedData));
        setMapHtml(savedMap);
      } catch (e) {
        localStorage.removeItem('slm_hub_resultData');
        localStorage.removeItem('slm_hub_mapHtml');
      }
    }
  }, []);
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const geojson = JSON.parse(event.target?.result as string);
        await analyzeHubs(geojson);
      } catch (err) {
        alert(t('invalid_json'));
      }
    };
    reader.readAsText(file);
  };

  const analyzeHubs = async (geojson: any) => {
    setIsAnalyzing(true);
    setResultData(null);
    setMapHtml(null);

    try {
      const response = await fetch("/api/analyze-hubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geojson: geojson,
          num_child_hubs: 0,
          district_name: "Target District",
          deployment_mode: "regional"
        }),
      });

      if (!response.ok) {
        throw new Error(t('analysis_failed'));
      }

      const data = await response.json();
      setResultData(data.data);
      setMapHtml(data.map_html);
      // Persist results so they survive navigation and refresh
      try {
        localStorage.setItem('slm_hub_resultData', JSON.stringify(data.data));
        localStorage.setItem('slm_hub_mapHtml', data.map_html);
      } catch (e) {
        // localStorage quota exceeded (map HTML can be large) — silently ignore
        console.warn('Could not persist hub results to localStorage:', e);
      }
    } catch (error) {
      console.error(error);
      alert(t('error_analyzing'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl font-sans relative z-10">
      <h2 className="text-[25px] font-bold mb-2 text-[#111111]">{t('area_planning_tool')}</h2>
      <p className="text-sm text-gray-600 mb-8">
        {t('area_planning_desc')}
      </p>

      {/* Upload Section */}
      {!resultData && !isAnalyzing && (
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="col-span-2 bg-white p-10 rounded-xl border border-gray-200 shadow-sm text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <UploadCloud size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2 text-[#111111]">{t('upload_geojson')}</h3>
            <p className="text-sm text-gray-500 mb-8 max-w-md">
              {t('upload_geojson_desc')}
            </p>
            <label className="cursor-pointer px-8 py-3 bg-[#163e2c] text-white font-bold rounded-lg hover:bg-[#1b4b35] transition-colors shadow-sm flex items-center gap-2">
              <FileJson size={18} />
              {t('browse_files')}
              <input type="file" accept=".json,.geojson" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          <div className="col-span-1 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-4 text-[#163e2c]">
              <Info size={20} />
              <h3 className="font-bold text-[#111111]">{t('what_is_geojson')}</h3>
            </div>
            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <p>{t('geojson_standard')}</p>
              <hr className="border-gray-200" />
              <p className="font-semibold text-gray-800">{t('geojson_how_to')}</p>
              <ol className="list-decimal pl-4 space-y-2">
                <li><a href="https://geojson.io/" target="_blank" className="text-blue-600 hover:underline font-medium">{t('geojson_step_1')}</a></li>
                <li>{t('geojson_step_2')}</li>
                <li>{t('geojson_step_3')}</li>
                <li><strong>{t('geojson_step_4')}</strong></li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Analyzing State */}
      {isAnalyzing && (
        <div className="bg-white p-12 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-emerald-600 mb-4" size={40} />
          <h3 className="text-lg font-bold text-gray-800 mb-2">{t('verifying_spatial')}</h3>
          <p className="text-sm text-gray-500">{t('verifying_spatial_desc')}</p>
        </div>
      )}

      {/* Results Section */}
      {resultData && !isAnalyzing && (
        <div className="animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <MapIcon className="text-emerald-600" />
              {t('analysis_complete')}
            </h3>
            <button 
              onClick={() => { 
                setResultData(null); 
                setMapHtml(null);
                localStorage.removeItem('slm_hub_resultData');
                localStorage.removeItem('slm_hub_mapHtml');
              }}
              className="text-[15px] font-bold text-white bg-red-500 hover:bg-red-600 px-6 py-2 rounded-full transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
              {t('start_over')}
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('total_hubs')}</p>
              <p className="text-2xl font-bold text-gray-900">{resultData.metadata.total_hubs}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('master_hubs')}</p>
              <p className="text-2xl font-bold text-red-500">{resultData.metadata.master_hubs}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('area_km2')}</p>
              <p className="text-2xl font-bold text-emerald-600">{resultData.metadata.area_km2} km²</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('avg_hub_spacing')}</p>
              <p className="text-2xl font-bold text-blue-600">{resultData.metadata.avg_hub_spacing_km} km</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('total_capex')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(resultData.metadata.total_capex_myr)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('annual_opex')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(resultData.metadata.annual_opex_myr)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('cost_per_km2')}</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(resultData.metadata.total_capex_myr / Math.max(1, resultData.metadata.area_km2))}
              </p>
            </div>
          </div>

          {/* Folium Map Container */}
          {mapHtml && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8 h-[600px] w-full">
              <iframe 
                className="w-full h-full border-0"
                srcDoc={mapHtml}
                title="Folium Map"
              />
            </div>
          )}



          {/* Detailed Breakdown */}
          {resultData.features && (
            <div className="mt-8 font-sans">
              <h3 className="text-xl font-bold text-[#111111] mb-6 border-b border-gray-200 pb-2">{t('location_breakdown')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {resultData.features.map((feature: any, idx: number) => {
                  const isMaster = feature.properties.type === "master";
                  const colorClass = isMaster ? "text-red-500" : "text-blue-500";
                  const label = feature.properties.label;
                  
                  return (
                    <div key={idx} className="flex items-start gap-2 text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                      <span className={`font-bold ${colorClass} min-w-[120px]`}>{label}:</span> 
                      <span className="font-mono text-gray-600">(La: {feature.properties.lat.toFixed(5)}, Long: {feature.properties.lng.toFixed(5)})</span>
                    </div>
                  );
                })}
              </div>
              
              <h3 className="text-[21px] font-bold text-[#111111] mt-8 mb-4">{t('detailed_cost_breakdown')}</h3>
              <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">{t('yearly_opex')}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600 font-bold text-red-500">{t('master_hub_label')} ({resultData.metadata.master_hubs}x):</span>
                      <span className="text-sm font-bold">{formatCurrency(resultData.features.filter((f: any) => f.properties.type === "master").reduce((sum: number, f: any) => sum + f.properties.annual_opex, 0))}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600 font-bold text-blue-500">{t('sub_hub_label')} ({resultData.metadata.child_hubs}x):</span>
                      <span className="text-sm font-bold">{formatCurrency(resultData.features.filter((f: any) => f.properties.type === "child").reduce((sum: number, f: any) => sum + f.properties.annual_opex, 0))}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-6 pt-6 border-t border-gray-100">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">{t('capex_breakdown')}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600 font-bold text-red-500">{t('master_hub_label')} ({resultData.metadata.master_hubs}x):</span>
                      <span className="text-sm font-bold">{formatCurrency(resultData.features.filter((f: any) => f.properties.type === "master").reduce((sum: number, f: any) => sum + f.properties.total_capex, 0))}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600 font-bold text-blue-500">{t('sub_hub_label')} ({resultData.metadata.child_hubs}x):</span>
                      <span className="text-sm font-bold">{formatCurrency(resultData.features.filter((f: any) => f.properties.type === "child").reduce((sum: number, f: any) => sum + f.properties.total_capex, 0))}</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-blue-600 font-medium italic mt-2">
                  {t('see_more_hub_arch')}
                </p>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
