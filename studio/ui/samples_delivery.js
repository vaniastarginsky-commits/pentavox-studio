// Reuse the existing Sampler transport and serial owner without mounting another editor.
// The canonical Samples iframe stays alive under the modal throughout delivery.
export function mountSamplesDelivery({root, home, document:doc=document, refresh=()=>{}}) {
  const dialog=doc.createElement('dialog');
  dialog.className='samples-delivery-dialog';
  dialog.setAttribute('aria-labelledby','samples-delivery-title');
  const header=doc.createElement('header');
  const title=doc.createElement('h2');title.id='samples-delivery-title';title.textContent='Samples · Device and SD';
  const close=doc.createElement('button');close.type='button';close.textContent='Return to project';
  header.append(title,close);
  const status=doc.createElement('p');status.className='samples-delivery-note';
  status.textContent='This panel delivers a prepared WAV, not an editable project copy. Check destination and compatibility. Closing this panel does not cancel a transfer already in progress.';
  const host=doc.createElement('div');host.className='samples-delivery-host';
  dialog.append(header,status,host);doc.body.append(dialog);
  const restore=()=>{home.append(root);};
  dialog.addEventListener('close',restore);
  close.addEventListener('click',()=>dialog.close());
  return {
    open(){host.append(root);if(!dialog.open)dialog.showModal();refresh();},
    close(){if(dialog.open)dialog.close();else restore();},
    dispose(){if(dialog.open)dialog.close();restore();dialog.remove();},
  };
}
