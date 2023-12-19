//config labeled-input


let prename = document.querySelector('[id="prename"]');
console.log(prename)
prename.setAttribute('shadowed', 'true');


prename.addEventListener('keyup', (e) => {
    console.log(e.srcElement.value);
});

