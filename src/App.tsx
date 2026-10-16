import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CondoStructure, MeterTarget, PhotoCampaign, Screen } from './types';
import { LUXOR_LUTECIA_CONDO } from './data/luxorLutecia';
import {
  createCampaign,
  db,
  deleteCampaign,
  deletePhotoRecord,
  ensureDefaultCondo,
  savePhotoRecord,
} from './db/database';
import { HomeScreen } from './screens/HomeScreen';
import { CollectScreen } from './screens/CollectScreen';
import { ExportScreen } from './screens/ExportScreen';

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedCondoId, setSelectedCondoId] = useState<string>(LUXOR_LUTECIA_CONDO.id);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    ensureDefaultCondo();
  }, []);

  const condos = useLiveQuery(() => db.condos.toArray(), [], [LUXOR_LUTECIA_CONDO]);
  const campaigns = useLiveQuery(
    () => db.campaigns.orderBy('updatedAt').reverse().toArray(),
    [],
    []
  );
  const allRecords = useLiveQuery(() => db.records.toArray(), [], []);

  const selectedCondo: CondoStructure =
    condos.find((c) => c.id === selectedCondoId) || condos[0] || LUXOR_LUTECIA_CONDO;

  const activeCampaign: PhotoCampaign | null =
    campaigns.find((c) => c.id === activeCampaignId) || null;

  const activeCondoForCampaign: CondoStructure = activeCampaign
    ? condos.find((c) => c.id === activeCampaign.condoId) || selectedCondo
    : selectedCondo;

  const campaignRecords = (allRecords || []).filter(
    (r) => r.campaignId === activeCampaign?.id
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  const handleImportCondo = async (newCondo: CondoStructure) => {
    await db.condos.put(newCondo);
    setSelectedCondoId(newCondo.id);
    showToast(`Condomínio "${newCondo.name}" importado com ${newCondo.units.length} unidades!`);
  };

  const handleCreateCampaign = async (name: string, month: number, year: number) => {
    const camp = await createCampaign({
      condoId: selectedCondo.id,
      condoName: selectedCondo.name,
      name,
      month,
      year,
    });
    setActiveCampaignId(camp.id);
    setScreen('collect');
    showToast(`Sessão "${camp.name}" iniciada!`);
  };

  const handleOpenCollect = (camp: PhotoCampaign) => {
    setActiveCampaignId(camp.id);
    setSelectedCondoId(camp.condoId);
    setScreen('collect');
  };

  const handleOpenExport = (camp: PhotoCampaign) => {
    setActiveCampaignId(camp.id);
    setSelectedCondoId(camp.condoId);
    setScreen('export');
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    await deleteCampaign(campaignId);
    if (activeCampaignId === campaignId) {
      setActiveCampaignId(null);
      setScreen('home');
    }
    showToast('Campanha excluída.');
  };

  const handleSavePhoto = async (
    target: MeterTarget,
    blob?: Blob,
    dims?: { width: number; height: number },
    issueNote?: string
  ) => {
    if (!activeCampaign) return;
    await savePhotoRecord(
      activeCampaign.id,
      activeCampaign.condoId,
      target,
      blob,
      dims,
      issueNote
    );
  };

  const handleDeletePhoto = async (targetId: string) => {
    if (!activeCampaign) return;
    await deletePhotoRecord(activeCampaign.id, targetId);
  };

  return (
    <div className="app-root">
      <div className="ocean-bg-glow" />

      {screen === 'home' && (
        <HomeScreen
          condos={condos.length > 0 ? condos : [LUXOR_LUTECIA_CONDO]}
          selectedCondo={selectedCondo}
          campaigns={campaigns}
          allRecords={allRecords}
          onSelectCondo={(c) => setSelectedCondoId(c.id)}
          onImportCondo={handleImportCondo}
          onCreateCampaign={handleCreateCampaign}
          onOpenCampaignCollect={handleOpenCollect}
          onOpenCampaignExport={handleOpenExport}
          onDeleteCampaign={handleDeleteCampaign}
          onNotify={showToast}
        />
      )}

      {screen === 'collect' && activeCampaign && (
        <CollectScreen
          condo={activeCondoForCampaign}
          campaign={activeCampaign}
          records={campaignRecords}
          onSavePhoto={handleSavePhoto}
          onDeletePhoto={handleDeletePhoto}
          onBackHome={() => setScreen('home')}
          onGoToExport={() => setScreen('export')}
          onNotify={showToast}
        />
      )}

      {screen === 'export' && activeCampaign && (
        <ExportScreen
          condo={activeCondoForCampaign}
          campaign={activeCampaign}
          records={campaignRecords}
          onBackToCollect={() => setScreen('collect')}
          onBackHome={() => setScreen('home')}
          onNotify={showToast}
        />
      )}

      {toastMessage && (
        <div className="global-toast" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;
