import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { strategyImportApi, StrategyImportResponse } from '@/services/api/strategyApi';
import './styles/StrategyImport.css';

const ACCEPT = '.pdf,.docx,.txt,.xlsx';
const MAX_BYTES = 10 * 1024 * 1024;

export default function StrategyImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StrategyImportResponse | null>(null);
  const [name, setName] = useState('');
  const [strategyType, setStrategyType] = useState('CUSTOM_IMPORTED');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetImport = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFile(null);
    setPreview(null);
    setName('');
    setStrategyType('CUSTOM_IMPORTED');
    setError(null);
    setLoading(false);
    setConfirming(false);
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return setError('Select a strategy document or Excel file.');
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!['.pdf', '.docx', '.txt', '.xlsx'].includes(extension)) return setError('Unsupported file type. Upload PDF, DOCX, TXT or XLSX.');
    if (file.size <= 0) return setError('The selected file is empty.');
    if (file.size > MAX_BYTES) return setError('File exceeds the 10 MB limit.');
    setLoading(true); setError(null);
    try {
      const result = await strategyImportApi.upload(file);
      setPreview(result);
      setName(file.name.replace(/\.[^.]+$/, '').slice(0, 255));
    } catch (err: any) {
      setError(err?.message || 'Unable to upload strategy file. Start the backend on port 8000 and verify strategy-import dependencies are installed.');
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!preview || !name.trim()) return setError('Strategy name is required before confirmation.');
    setConfirming(true); setError(null);
    try {
      const result = await strategyImportApi.confirm(preview.id, { name: name.trim(), strategy_type: strategyType.trim() || 'CUSTOM_IMPORTED' });
      navigate(`/strategies/${result.strategy_definition_id}`);
    } catch (err: any) { setError(err?.message || 'Unable to save imported strategy.'); }
    finally { setConfirming(false); }
  };

  return <div className="strategy-import-page">
    <header className="strategy-import-hero">
      <div><span className="strategy-eyebrow">STRATEGY LIBRARY</span><h1>Import Strategy</h1><p>Upload a strategy document or Excel rules, review what the parser extracted, then explicitly confirm before it becomes a saved strategy.</p></div>
      <button className="strategy-btn strategy-btn-secondary" onClick={() => navigate('/strategies')} disabled={loading || confirming}>← Back to Strategies</button>
    </header>
    {error && <div className="strategy-alert" role="alert"><div><strong>Import failed</strong><span>{error}</span></div></div>}
    {!preview ? <form className="strategy-import-upload" onSubmit={handleUpload}>
      <div className="strategy-upload-icon">↑</div><h2>Upload strategy source</h2><p>Supported: PDF, DOCX, TXT and XLSX · Maximum 10 MB</p>
      <label className="strategy-file-picker"><input ref={fileInputRef} id="strategy-file" type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={loading}/><span>{file ? file.name : 'Choose a file'}</span></label>
      {file && <div className="strategy-file-meta">{(file.size / 1024).toFixed(1)} KB · Ready for parsing</div>}
      <div className="strategy-import-actions">
        <button className="strategy-btn strategy-btn-secondary" type="button" onClick={resetImport} disabled={!file || loading}>Reset File</button>
        <button className="strategy-btn strategy-btn-primary" type="submit" disabled={!file || loading}>{loading ? 'Uploading & parsing…' : 'Upload & Preview'}</button>
      </div>
    </form> : <div className="strategy-import-grid">
      <section className="strategy-import-panel"><span className="strategy-eyebrow">CONFIRMATION</span><h2>Save Strategy</h2><label>Strategy name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={255}/></label><label>Strategy type<input value={strategyType} onChange={(e) => setStrategyType(e.target.value)} maxLength={64}/></label>{preview.warnings.length > 0 && <div className="strategy-warning"><strong>Review warnings</strong><ul>{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>}<div className="strategy-import-actions"><button className="strategy-btn strategy-btn-secondary" type="button" onClick={resetImport}>Choose another file</button><button className="strategy-btn strategy-btn-primary" onClick={() => void handleConfirm()} disabled={confirming || !name.trim()}>{confirming ? 'Saving…' : 'Confirm & Save Strategy'}</button></div></section>
      <section className="strategy-import-panel"><span className="strategy-eyebrow">PARSED RESULT</span><h2>Extracted Rules</h2>{Object.keys(preview.extracted_config).length ? <pre>{JSON.stringify(preview.extracted_config, null, 2)}</pre> : <div className="strategy-no-rules">No structured key/value rules detected. Review the source text carefully before confirming.</div>}<h3>Source text</h3><pre className="strategy-source-text">{preview.extracted_text || 'No extractable text found.'}</pre></section>
    </div>}
  </div>;
}
