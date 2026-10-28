const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = /\.(jpe?g|png|webp|pdf|ai|psd|zip)$/i;

export function selectFiles(component, event) {
  const files = [...(event.target.files || [])];
  const error = files.length > 5 || files.reduce((n, file) => n + file.size, 0) > MAX_BYTES
    ? '첨부 파일은 최대 5개, 합계 2MB까지 가능합니다.'
    : files.some(file => !ALLOWED.test(file.name) || !file.size)
      ? 'JPG, PNG, WEBP, PDF, AI, PSD, ZIP 형식의 비어 있지 않은 파일을 선택해 주세요.' : '';
  if (error) event.target.value = '';
  component.setState({ files: error ? [] : files, formErr: error });
}

const encodeFile = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve({ filename: file.name, content: reader.result.split(',')[1] });
  reader.onerror = () => reject(new Error('첨부 파일을 읽지 못했습니다. 다시 선택해 주세요.'));
  reader.readAsDataURL(file);
});

export async function submitInquiry(component, event) {
  event.preventDefault();
  if (component.sending) return;
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  component.sending = true;
  component.setState({ submitting: true, formErr: '' });
  try {
    const state = component.state;
    const payload = {
      ...state.form, items: state.items, quantity: state.qty, budget: state.budget || '',
      website: new FormData(form).get('website') || '',
      attachments: await Promise.all((state.files || []).map(encodeFile)),
    };
    const fingerprint = JSON.stringify(payload);
    if (!component.inquiryAttempt || component.inquiryAttempt.fingerprint !== fingerprint) {
      component.inquiryAttempt = { id: crypto.randomUUID(), fingerprint };
    }
    const response = await fetch('/api/contact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, requestId: component.inquiryAttempt.id }),
      signal: AbortSignal.timeout(35000),
    });
    const result = await response.json();
    if (!response.ok || !result.accepted) throw new Error(result.message || '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    component.setState({ sent: true, receiptId: result.requestId, formErr: '' });
    component.scrollTop();
  } catch (error) {
    const network = ['AbortError', 'TimeoutError', 'TypeError'].includes(error.name);
    component.setState({ formErr: network
      ? '전송 결과를 확인하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 같은 내용으로 다시 시도해 주세요.'
      : error.message });
  } finally {
    component.sending = false;
    component.setState({ submitting: false });
  }
}
