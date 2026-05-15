import { MapPin, ServerCog, FileVideo, Bot, Key, Network } from "lucide-react";
import { useSettings } from "../lib/SettingsContext";

export default function HelpPage() {
  const { t } = useSettings();

  return (
    <div className="p-8 max-w-6xl font-sans animate-in fade-in duration-300 relative z-10">
      <h2 className="text-[25px] font-bold mb-2 text-[#111111]">{t('how_to_use')}</h2>
      <p className="text-gray-600 mb-8 leading-relaxed">{t('help_guide_intro')}</p>

      <div className="space-y-6">

        {/* Section 1: Hub Placement */}
        <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
          <div className="flex items-center gap-3 mb-4 pl-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><MapPin size={24} /></div>
            <h3 className="text-xl font-bold text-[#111111]">{t('help_hub_placement_title')}</h3>
          </div>
          <div className="pl-4">
            <p className="text-gray-600 mb-3"><strong>{t('help_hub_placement_goal')}</strong></p>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-500">
              <li>{t('help_hub_step1')}</li>
              <li>{t('help_hub_step2')}</li>
              <li>{t('help_hub_step3')}</li>
              <li>{t('help_hub_step4')}</li>
              <li>{t('help_hub_step5')}</li>
              <li>{t('help_hub_step6')}</li>
            </ol>
          </div>
        </section>

        {/* Section 2: Hub Architecture */}
        <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
          <div className="flex items-center gap-3 mb-4 pl-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Network size={24} /></div>
            <h3 className="text-xl font-bold text-[#111111]">{t('help_hub_arch_title')}</h3>
          </div>
          <div className="pl-4">
            <p className="text-gray-600 mb-3"><strong>{t('help_hub_arch_goal')}</strong></p>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-500">
              <li>{t('help_arch_step1')}</li>
              <li>{t('help_arch_step2')}</li>
              <li>{t('help_arch_step3')}</li>
              <li>{t('help_arch_step4')}</li>
            </ol>
          </div>
        </section>

        {/* Section 3: AI Training */}
        <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
          <div className="flex items-center gap-3 mb-4 pl-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Bot size={24} /></div>
            <h3 className="text-xl font-bold text-[#111111]">{t('help_training_title')}</h3>
          </div>
          <div className="pl-4">
            <p className="text-gray-600 mb-3"><strong>{t('help_training_goal')}</strong></p>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-500">
              <li>{t('help_train_step1')}</li>
              <li>{t('help_train_step2')}</li>
              <li>{t('help_train_step3')}</li>
              <li>{t('help_train_step4')}</li>
              <li>{t('help_train_step5')}</li>
              <li>{t('help_train_step6')}</li>
              <li>{t('help_train_step7')}</li>
            </ol>
          </div>
        </section>

        {/* Section 4: Content Moderation */}
        <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-purple-500"></div>
          <div className="flex items-center gap-3 mb-4 pl-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><FileVideo size={24} /></div>
            <h3 className="text-xl font-bold text-[#111111]">{t('help_moderation_title')}</h3>
          </div>
          <div className="pl-4">
            <p className="text-gray-600 mb-3"><strong>{t('help_moderation_goal')}</strong></p>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-500">
              <li>{t('help_mod_step1')}</li>
              <li>{t('help_mod_step2')}</li>
              <li>{t('help_mod_step3')}</li>
              <li>{t('help_mod_step4')}</li>
              <li>{t('help_mod_step5')}</li>
            </ol>
          </div>
        </section>

        {/* Section 5: Admin Profile */}
        <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-amber-500"></div>
          <div className="flex items-center gap-3 mb-4 pl-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Key size={24} /></div>
            <h3 className="text-xl font-bold text-[#111111]">{t('help_admin_title')}</h3>
          </div>
          <div className="pl-4">
            <p className="text-gray-600 mb-3"><strong>{t('help_admin_goal')}</strong></p>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-500">
              <li>{t('help_admin_step1')}</li>
              <li>{t('help_admin_step2')}</li>
              <li>{t('help_admin_step3')}</li>
              <li>{t('help_admin_step4')}</li>
              <li>{t('help_admin_step5')}</li>
              <li>{t('help_admin_step6')}</li>
              <li>{t('help_admin_step7')}</li>
            </ol>
          </div>
        </section>

        {/* Configuration Prerequisites */}
        <div className="bg-slate-50 p-8 rounded-xl border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ServerCog size={20} className="text-slate-500" />
            {t('help_prereq_title')}
          </h3>
          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-6">
            <div>
              <h4 className="font-bold text-gray-800 mb-2">{t('help_gdrive_setup_title')}</h4>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                <li>{t('help_gdrive_step1')}</li>
                <li>{t('help_gdrive_step2')}</li>
                <li>{t('help_gdrive_step3')}</li>
                <li>{t('help_gdrive_step4')}</li>
                <li>{t('help_gdrive_step5')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-800 mb-2">{t('help_aws_setup_title')}</h4>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                <li>{t('help_aws_s1')}</li>
                <li>{t('help_aws_s2')}</li>
                <li>{t('help_aws_s3')}</li>
                <li>{t('help_aws_s4')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-800 mb-2">{t('help_hf_setup_title')}</h4>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                <li>{t('help_hf_step1')}</li>
                <li>{t('help_hf_step2')}</li>
              </ul>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-emerald-700">{t('help_prereq_summary')}</p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="mt-12 p-8 bg-white rounded-xl border-2 border-emerald-100 shadow-sm text-center">
          <h4 className="text-[16px] font-bold text-gray-800 mb-4">{t('help_contact_builder')}</h4>
          <div className="space-y-2 text-[16px] font-medium text-gray-600">
            <p>HP: <span className="text-emerald-700">012-732 3069</span></p>
            <p>GMAIL: <span className="text-emerald-700">weesheng2007@gmail.com</span></p>
          </div>
        </div>

      </div>
    </div>
  );
}
