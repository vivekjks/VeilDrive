import { Check, FileLock, UploadSimple } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useAppStore } from '../store/AppStore';
import type { PrivacyLevel } from '../types';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  parentId: string | null;
  onComplete?: (fileId: string) => void;
}

export const UploadModal = ({ open, onClose, parentId, onComplete }: UploadModalProps) => {
  const { actions } = useAppStore();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [privacy, setPrivacy] = useState<PrivacyLevel>('private');
  const [stage, setStage] = useState<'idle' | 'encrypting' | 'storing' | 'registering' | 'done'>('idle');
  const [error, setError] = useState('');

  const reset = () => { setFiles([]); setStage('idle'); setError(''); };
  const close = () => { if (stage === 'encrypting' || stage === 'storing') return; reset(); onClose(); };

  const performUpload = async () => {
    if (files.length === 0) return;
    setError('');
    try {
      setStage('encrypting');
      await new Promise((resolve) => window.setTimeout(resolve, 420));
      setStage('storing');
      const results = await actions.upload(files, parentId, privacy);
      setStage('registering');
      await new Promise((resolve) => window.setTimeout(resolve, 520));
      setStage('done');
      onComplete?.(results[0]!.item.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Upload failed.');
      setStage('idle');
    }
  };

  return (
    <Modal open={open} onClose={close} title="Protect and upload">
      <div className="upload-flow">
        {stage === 'done' ? (
          <div className="upload-success"><span><Check size={32} weight="light" /></span><h3>Encrypted. Stored. Registered.</h3><p>Your readable file never left this device. Its commitment is ready for verification.</p><Button tone="primary" onClick={close}>View in drive</Button></div>
        ) : (
          <>
            <button className="drop-zone" onClick={() => input.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setFiles(Array.from(event.dataTransfer.files)); }}>
              <span><UploadSimple size={28} weight="light" /></span>
              <strong>{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : 'Drop files into your private vault'}</strong>
              <small>{files.length ? files.map((file) => file.name).join(', ') : 'or choose files from this device'}</small>
            </button>
            <input ref={input} className="sr-only" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
            <div className="privacy-presets">
              {(['standard', 'private', 'confidential', 'maximum'] as PrivacyLevel[]).map((level) => (
                <button key={level} className={privacy === level ? 'is-active' : ''} onClick={() => setPrivacy(level)}><span>{level}</span><small>{level === 'standard' ? 'Encrypted file' : level === 'private' ? 'Encrypted metadata' : level === 'confidential' ? 'Credential rules' : 'Minimal disclosure'}</small></button>
              ))}
            </div>
            {stage !== 'idle' && <div className="upload-progress"><div className="upload-progress__bar"><i style={{ transform: `scaleX(${stage === 'encrypting' ? .32 : stage === 'storing' ? .66 : .92})` }} /></div><p><FileLock size={16} weight="light" />{stage === 'encrypting' ? 'Encrypting locally with AES‑256‑GCM…' : stage === 'storing' ? 'Writing ciphertext to encrypted storage…' : 'Registering commitment on Midnight preprod…'}</p></div>}
            {error && <p className="form-error">{error}</p>}
            <footer className="modal-actions"><Button tone="quiet" trailing={false} onClick={close}>Cancel</Button><Button tone="primary" onClick={performUpload} disabled={files.length === 0 || stage !== 'idle'}>Encrypt & upload</Button></footer>
          </>
        )}
      </div>
    </Modal>
  );
};
