//config labeled-input


let prename = document.querySelector('[id="prename"]');
console.log(prename)
prename.setAttribute('shadowed', 'true');


prename.addEventListener('input', (e) => {
    console.log(e);
});

