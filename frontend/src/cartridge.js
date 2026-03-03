export function initCartridgeSystem(onFileDropped) {
    const dropZone = document.getElementById('drop-zone');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.py,.pine,.mq4,.mq5';
    input.hidden = true;
    document.body.appendChild(input);

    const handleFiles = (fileList) => {
        const file = fileList && fileList[0];
        if (!file) {
            return;
        }

        onFileDropped(file);
    };

    ['dragenter', 'dragover'].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (event) => {
        handleFiles(event.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => handleFiles(input.files));
}
