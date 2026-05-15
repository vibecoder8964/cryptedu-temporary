import { useState, useEffect } from "react";
import { User, UploadCloud, Save, Settings, Globe, Shield, Cloud, Loader2 } from "lucide-react";
import { useSettings } from "../lib/SettingsContext";
import { currencies } from "../lib/currencies";
import { languages } from "../lib/languages";

export default function AdminProfilePage() {
  const { language, setLanguage, currency, setCurrency, hubRates, setHubRates, t } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    name: "Ahmad Bin Yusuf",
    governmentId: "KPM-MY-2023-8901",
    role: "Regional Moderator",
  });

  const [awsConfig, setAwsConfig] = useState({
    accessKey: "",
    secretKey: "",
    region: "us-east-1",
    bedrockRoleArn: "",
    s3TrainingBucket: "cryptedu-training-data",
    lambdaUrl: "",
    lambdaApiKey: ""
  });

  const [googleConfig, setGoogleConfig] = useState({
    clientEmail: "",
    privateKey: "",
    projectId: "",
    driveFolderId: ""
  });

  const [credsMasked, setCredsMasked] = useState({
    accessKeyMasked: "",
    secretKeyMasked: "",
    roleArnMasked: "",
    googleEmailMasked: "",
    googleKeyMasked: "",
    lambdaApiKeyMasked: ""
  });

  const [avatar, setAvatar] = useState<string | null>(null);

  // Hydrate profile from database on load
  useEffect(() => {
    fetch("/api/v1/user/profile", { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data && data.full_name) {
          setProfile({
            name: data.full_name,
            governmentId: data.government_id || "",
            role: data.role || "Regional Moderator",
          });
          setAwsConfig(prev => ({
            ...prev,
            region: data.aws_region || "us-east-1",
            s3TrainingBucket: data.s3_training_bucket || "cryptedu-training-data",
            lambdaUrl: data.lambda_url || "",
          }));
          setGoogleConfig(prev => ({
            ...prev,
            projectId: data.google_project_id || "",
            driveFolderId: data.google_drive_folder_id || ""
          }));
          setCredsMasked({
            accessKeyMasked: data.aws_access_key_masked || "",
            secretKeyMasked: data.aws_secret_key_masked || "",
            roleArnMasked: data.bedrock_role_arn_masked || "",
            googleEmailMasked: data.google_client_email_masked || "",
            googleKeyMasked: data.google_private_key_masked || "",
            lambdaApiKeyMasked: data.lambda_api_key_masked || ""
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file);
      setAvatar(imageUrl);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    try {
      // 1. Save profile
      await fetch("/api/v1/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          full_name: profile.name,
          role: profile.role,
          government_id: profile.governmentId
        })
      });

      // 2. Save credentials (Base64 encoded for transport)
      const credPayload: any = {
        aws_access_key: awsConfig.accessKey ? btoa(unescape(encodeURIComponent(awsConfig.accessKey))) : "",
        aws_secret_key: awsConfig.secretKey ? btoa(unescape(encodeURIComponent(awsConfig.secretKey))) : "",
        aws_region: awsConfig.region,
        bedrock_role_arn: awsConfig.bedrockRoleArn ? btoa(unescape(encodeURIComponent(awsConfig.bedrockRoleArn))) : "",
        s3_training_bucket: awsConfig.s3TrainingBucket,
        google_client_email: googleConfig.clientEmail ? btoa(unescape(encodeURIComponent(googleConfig.clientEmail))) : "",
        google_private_key: googleConfig.privateKey ? btoa(unescape(encodeURIComponent(googleConfig.privateKey))) : "",
        google_project_id: googleConfig.projectId,
        google_drive_folder_id: googleConfig.driveFolderId,
        lambda_url: awsConfig.lambdaUrl,
        lambda_api_key: awsConfig.lambdaApiKey ? btoa(unescape(encodeURIComponent(awsConfig.lambdaApiKey))) : "",
      };

      await fetch("/api/v1/user/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(credPayload)
      });

      setSaveStatus("success");
      // Refresh masked values
      const res = await fetch("/api/v1/user/profile", { credentials: 'include' });
      const data = await res.json();
      if (data) {
        setCredsMasked({
          accessKeyMasked: data.aws_access_key_masked || "",
          secretKeyMasked: data.aws_secret_key_masked || "",
          roleArnMasked: data.bedrock_role_arn_masked || "",
          googleEmailMasked: data.google_client_email_masked || "",
          googleKeyMasked: data.google_private_key_masked || "",
          lambdaApiKeyMasked: data.lambda_api_key_masked || "",
        });
        // Clear raw inputs after save
        setAwsConfig(prev => ({
          ...prev,
          accessKey: "",
          secretKey: "",
          bedrockRoleArn: "",
          lambdaApiKey: "",
        }));
        setGoogleConfig(prev => ({
          ...prev,
          clientEmail: "",
          privateKey: "",
        }));
      }
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  return (
    <div className="p-8 max-w-6xl font-sans animate-in fade-in duration-300 relative z-10">
      <h2 className="text-[25px] font-bold mb-2 text-[#111111]">{t('admin_profile')}</h2>
      <p className="text-sm text-gray-600 mb-8">
        {t('admin_profile_desc')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Avatar Upload Column */}
        <div className="col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center">
          <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden mb-6 border-4 border-emerald-50">
            {avatar ? (
              <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={48} className="text-gray-400" />
            )}
          </div>
          
          <label className="cursor-pointer px-4 py-2 bg-[#e8f5e9] text-[#2d5a2d] text-sm font-bold rounded-lg hover:bg-[#c8e6c9] transition-colors shadow-sm flex items-center gap-2 mb-2 w-full justify-center">
            <UploadCloud size={16} />
            {t('upload_picture')}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
          <p className="text-xs text-gray-500 text-center mt-2">
            {t('recommended_size')}
          </p>
        </div>

        {/* Profile Details Column */}
        <div className="col-span-2 bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <h3 className="text-xl font-bold text-[#111111] mb-6 flex items-center gap-2">
            <User className="text-[#163e2c]" size={24} />
            {t('official_identity')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('full_name')}</label>
              <input 
                type="text" 
                value={profile.name} 
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('government_id')}</label>
              <input 
                type="text" 
                value={profile.governmentId} 
                onChange={(e) => setProfile({ ...profile, governmentId: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('assigned_role')}</label>
              <select 
                value={profile.role} 
                onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              >
                <option value="Regional Moderator">{t('role_regional_mod')}</option>
                <option value="System Architect">{t('role_system_arch')}</option>
                <option value="Curriculum Lead">{t('role_curriculum_lead')}</option>
                <option value="Field Engineer">{t('role_field_engineer')}</option>
                <option value="Data Scientist">{t('role_data_scientist')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* AWS Cloud Configuration */}
        <div className="col-span-3 bg-white p-8 rounded-xl border border-gray-200 shadow-sm mt-4 space-y-6">
          <h3 className="text-xl font-bold text-[#111111] mb-2 flex items-center gap-2">
            <Shield className="text-emerald-600" size={24} />
            {t('aws_cloud_config')}
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            {t('aws_config_desc')}
          </p>

          {/* Current credential status */}
          {credsMasked.accessKeyMasked && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
              <Shield size={16} />
              <span className="font-medium">{t('stored_encrypted')}</span>
              <code className="bg-emerald-100 px-2 py-0.5 rounded text-xs">{credsMasked.accessKeyMasked}</code>
              <code className="bg-emerald-100 px-2 py-0.5 rounded text-xs">{credsMasked.secretKeyMasked}</code>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('aws_access_key')}</label>
              <input 
                type="text" 
                placeholder={credsMasked.accessKeyMasked || "AKIA..."}
                value={awsConfig.accessKey} 
                onChange={(e) => setAwsConfig({ ...awsConfig, accessKey: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('aws_secret_key')}</label>
              <input 
                type="password" 
                placeholder={credsMasked.secretKeyMasked || "••••••••••••"}
                value={awsConfig.secretKey} 
                onChange={(e) => setAwsConfig({ ...awsConfig, secretKey: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('aws_region')}</label>
              <input 
                type="text" 
                placeholder="us-east-1"
                value={awsConfig.region} 
                onChange={(e) => setAwsConfig({ ...awsConfig, region: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Bedrock & S3 Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Cloud size={14} className="text-blue-500" />
                {t('bedrock_role_arn')}
              </label>
              <input 
                type="password" 
                placeholder={credsMasked.roleArnMasked || "arn:aws:iam::..."}
                value={awsConfig.bedrockRoleArn} 
                onChange={(e) => setAwsConfig({ ...awsConfig, bedrockRoleArn: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Required for Bedrock fine-tuning jobs</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Cloud size={14} className="text-blue-500" />
                {t('s3_training_bucket')}
              </label>
              <input 
                type="text" 
                placeholder="cryptedu-training-data"
                value={awsConfig.s3TrainingBucket} 
                onChange={(e) => setAwsConfig({ ...awsConfig, s3TrainingBucket: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">S3 bucket for training datasets</p>
            </div>
          </div>

          {/* Lambda Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Cloud size={14} className="text-purple-500" />
                Lambda Function URL
              </label>
              <input
                type="text"
                placeholder="https://xxxxxxxxxx.lambda-url.us-east-1.on.aws/"
                value={awsConfig.lambdaUrl}
                onChange={(e) => setAwsConfig({ ...awsConfig, lambdaUrl: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">If set, video moderation will use this Lambda instead of Bedrock directly</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Cloud size={14} className="text-purple-500" />
                Lambda API Key
              </label>
              <input
                type="password"
                placeholder={credsMasked.lambdaApiKeyMasked || "••••••••••••"}
                value={awsConfig.lambdaApiKey}
                onChange={(e) => setAwsConfig({ ...awsConfig, lambdaApiKey: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Sent as x-api-key header (optional)</p>
            </div>
          </div>
        </div>

        {/* Google Cloud Configuration */}
        <div className="col-span-3 bg-white p-8 rounded-xl border border-gray-200 shadow-sm mt-4 space-y-6">
          <h3 className="text-xl font-bold text-[#111111] mb-2 flex items-center gap-2">
            <Cloud className="text-blue-600" size={24} />
            Google Cloud & Drive Configuration
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            Configure your Google Service Account credentials to enable the Google Drive dataset upload pipeline. Credentials are Fernet-encrypted at rest.
          </p>

          {/* Current credential status */}
          {credsMasked.googleEmailMasked && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <Shield size={16} />
              <span className="font-medium">Stored (Fernet-Encrypted):</span>
              <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">{credsMasked.googleEmailMasked}</code>
              <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">{credsMasked.googleKeyMasked}</code>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Service Account Email</label>
              <input 
                type="text" 
                placeholder={credsMasked.googleEmailMasked || "service-account@project.iam.gserviceaccount.com"}
                value={googleConfig.clientEmail} 
                onChange={(e) => setGoogleConfig({ ...googleConfig, clientEmail: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Google Cloud Project ID</label>
              <input 
                type="text" 
                placeholder="my-edu-project-123"
                value={googleConfig.projectId} 
                onChange={(e) => setGoogleConfig({ ...googleConfig, projectId: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Private Key - Full width textarea for easy pasting */}
          <div className="grid grid-cols-1 gap-6 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('private_key_label')}</label>
              <textarea 
                placeholder={credsMasked.googleKeyMasked || "-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----"}
                value={googleConfig.privateKey} 
                onChange={(e) => setGoogleConfig({ ...googleConfig, privateKey: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs"
              />
              <p className="text-xs text-gray-400 mt-1">{t('private_key_help')}</p>
            </div>
          </div>

          {/* Drive Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Cloud size={14} className="text-blue-500" />
                {t('gdrive_folder_id_label')}
              </label>
              <input 
                type="text" 
                placeholder="1A2B3C4D5E6F7G8H9I0J..."
                value={googleConfig.driveFolderId} 
                onChange={(e) => setGoogleConfig({ ...googleConfig, driveFolderId: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">{t('folder_shared_help')}</p>
            </div>
          </div>
        </div>

        {/* System Preferences Column */}
        <div className="col-span-3 bg-white p-8 rounded-xl border border-gray-200 shadow-sm mt-4 space-y-6">
          <h3 className="text-xl font-bold text-[#111111] mb-6 flex items-center gap-2">
            <Globe className="text-blue-600" size={24} />
            {t('system_preferences')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('language')}</label>
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('currency')}</label>
              <select 
                value={currency} 
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                {Object.values(currencies).map((c) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name} ({c.symbol})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Market Assumptions Column */}
        <div className="col-span-3 bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <h3 className="text-xl font-bold text-[#111111] mb-6 flex items-center gap-2">
            <Settings className="text-orange-600" size={24} />
            {t('market_assumptions')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('master_hub_capex')} ({currency} Base)</label>
              <input 
                type="number" 
                value={Math.round(hubRates.masterCapex * currencies[currency].rate)} 
                onChange={(e) => setHubRates({ ...hubRates, masterCapex: Number(e.target.value) / currencies[currency].rate })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('master_hub_opex')} ({currency} Base)</label>
              <input 
                type="number" 
                value={Math.round(hubRates.masterOpex * currencies[currency].rate)} 
                onChange={(e) => setHubRates({ ...hubRates, masterOpex: Number(e.target.value) / currencies[currency].rate })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('sub_hub_capex')} ({currency} Base)</label>
              <input 
                type="number" 
                value={Math.round(hubRates.subCapex * currencies[currency].rate)} 
                onChange={(e) => setHubRates({ ...hubRates, subCapex: Number(e.target.value) / currencies[currency].rate })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('sub_hub_opex')} ({currency} Base)</label>
              <input 
                type="number" 
                value={Math.round(hubRates.subOpex * currencies[currency].rate)} 
                onChange={(e) => setHubRates({ ...hubRates, subOpex: Number(e.target.value) / currencies[currency].rate })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Unified Save Button */}
        <div className="col-span-3 mt-2">
          {saveStatus && (
            <div className={`mb-4 p-4 rounded-xl font-medium text-sm ${saveStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {saveStatus === 'success' ? '✅ ' + t('profile_saved') : '❌ Failed to save. Please check your connection.'}
            </div>
          )}
          <button 
            onClick={handleSaveAll}
            disabled={isSaving}
            className="w-full px-8 py-4 bg-[#163e2c] text-white font-bold rounded-xl hover:bg-[#1b4b35] transition-all shadow-lg flex items-center justify-center gap-3 text-lg disabled:opacity-50 active:scale-[0.98]"
          >
            {isSaving ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                {t('encrypting_saving')}
              </>
            ) : (
              <>
                <Save size={22} />
                {t('save_profile')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
