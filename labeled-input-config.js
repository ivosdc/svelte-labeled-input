//config labeled-input


let prename = document.getElementById('prename');

prename.setAttribute('shadowed', 'true');

prename.addEventListener('input', (e) => {
    console.log('input');
});
