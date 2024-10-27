async function getAuthToken() {
    try {
        const response = await fetch('/get-token'); 
        console.log(response);
        const data = await response.json();
        console.log(data);
        return data.token;  
    } catch (error) {
        console.error('Error getting auth token from backend:', error);
        return null;
    }
}

async function updateTicketCount() {
    try {
        const response = await fetch('/api/ticket-count');
        const data = await response.json();
        document.getElementById('ticketCount').textContent = data.ticketCount;
    } catch (error) {
        console.error('Error fetching ticket count:', error);
        document.getElementById('ticketCount').textContent = 'Error';
    }
}

document.getElementById('ticketForm').addEventListener('submit', async function (e) {
    e.preventDefault(); 

    const vatin = document.getElementById('vatin').value;
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;

    const messageDiv = document.getElementById('message');
    const qrCodeDiv = document.getElementById('qrCode'); 

    const token = await getAuthToken();
    if (!token) {
        messageDiv.innerHTML = `<p style="color: red;">Failed to get authorization token</p>`;
        return;
    }

    try {
        const response = await fetch('https://auth-1-9m3o.onrender.com/create-ticket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`  
            },
            body: JSON.stringify({ vatin, firstName, lastName })
        });

        console.log(response);


        const data = await response.json();
        console.log(data);


        if (response.ok) {
            console.log("hello world")
            messageDiv.innerHTML = `<p>Ulaznica uspješno kreirana! ID: ${data.ticket_id}</p>`;
            qrCodeDiv.innerHTML = `<img src="${data.qrCode}" alt="QR Code for your ticket" />`; 

            updateTicketCount();
        } else {
            console.log("hello world2")
            if (data.error === 'MaxTicketsExceeded') {
                messageDiv.innerHTML = `<p style="color: red;">${data.message}</p>`;
            } else {
                messageDiv.innerHTML = `<p style="color: red;">Error: ${data.message || 'Greška pri kreiranju ulaznice.'}</p>`;
            }
        }
    } catch (error) {
        console.log("errrroorrrrrr");
        console.error('Error:', error);
        messageDiv.innerHTML = `<p style="color: red;">Greška!</p>`;
    }

});

window.onload = updateTicketCount;