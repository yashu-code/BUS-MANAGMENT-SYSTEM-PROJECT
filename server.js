const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from current directory

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Replace with your MySQL username
    password: 'Yashu2005@', // Replace with your MySQL password
    database: 'project_new'
});

// Check database connection
db.connect((err) => {
    if (err) {
        console.error('[ERROR] Database connection failed:', err.message);
        return;
    }
    console.info('[INFO] Connected to MySQL database "project_new"');
});

// ======================
// STATION ROUTES
// ======================

// GET all stations
app.get('/api/stations', (req, res) => {
    console.log('GET /api/stations - Fetching all stations');
    const query = 'SELECT * FROM Station ORDER BY Name';
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching stations:', err);
            return res.status(500).json({ error: 'Failed to fetch stations' });
        }
        console.log(`Found ${results.length} stations`);
        res.json(results);
    });
});

// POST create new station
app.post('/api/stations', (req, res) => {
    console.log('POST /api/stations - Creating new station:', req.body);
    
    const { name, location, code } = req.body;
    
    // Validate required fields
    if (!name || !location || !code) {
        console.log('Validation failed: Missing required fields');
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate code length
    if (code.length < 3 || code.length > 10) {
        console.log('Validation failed: Invalid code length');
        return res.status(400).json({ error: 'Station code must be between 3 and 10 characters' });
    }
    
    const query = 'INSERT INTO Station (Name, Location, Code) VALUES (?, ?, ?)';
    
    db.query(query, [name, location, code], (err, result) => {
        if (err) {
            console.error('Error creating station:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Station name or code already exists' });
            }
            return res.status(500).json({ error: 'Failed to create station' });
        }
        
        console.log('Station created successfully with ID:', result.insertId);
        res.status(201).json({ 
            message: 'Station created successfully', 
            stationId: result.insertId 
        });
    });
});

// PUT update station
app.put('/api/stations/:id', (req, res) => {
    console.log('PUT /api/stations/:id - Updating station:', req.params.id, req.body);
    
    const { id } = req.params;
    const { name, location, code } = req.body;
    
    // Validate required fields
    if (!name || !location || !code) {
        console.log('Validation failed: Missing required fields');
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate code length
    if (code.length < 3 || code.length > 10) {
        console.log('Validation failed: Invalid code length');
        return res.status(400).json({ error: 'Station code must be between 3 and 10 characters' });
    }
    
    const query = 'UPDATE Station SET Name = ?, Location = ?, Code = ? WHERE StationID = ?';
    
    db.query(query, [name, location, code, id], (err, result) => {
        if (err) {
            console.error('Error updating station:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Station name or code already exists' });
            }
            return res.status(500).json({ error: 'Failed to update station' });
        }
        
        if (result.affectedRows === 0) {
            console.log('Station not found for update');
            return res.status(404).json({ error: 'Station not found' });
        }
        
        console.log('Station updated successfully');
        res.json({ message: 'Station updated successfully' });
    });
});

// DELETE station
app.delete('/api/stations/:id', (req, res) => {
    console.log('DELETE /api/stations/:id - Deleting station:', req.params.id);
    
    const { id } = req.params;
    
    // First check if station is used in schedules
    const checkQuery = 'SELECT COUNT(*) as count FROM BusSchedule WHERE StartStationID = ? OR EndStationID = ?';
    
    db.query(checkQuery, [id, id], (err, results) => {
        if (err) {
            console.error('Error checking station usage:', err);
            return res.status(500).json({ error: 'Failed to check station usage' });
        }
        
        if (results[0].count > 0) {
            console.log('Cannot delete station - it is being used in schedules');
            return res.status(400).json({ 
                error: 'Cannot delete station. It is being used in bus schedules.' 
            });
        }
        
        // Safe to delete
        const deleteQuery = 'DELETE FROM Station WHERE StationID = ?';
        
        db.query(deleteQuery, [id], (err, result) => {
            if (err) {
                console.error('Error deleting station:', err);
                return res.status(500).json({ error: 'Failed to delete station' });
            }
            
            if (result.affectedRows === 0) {
                console.log('Station not found for deletion');
                return res.status(404).json({ error: 'Station not found' });
            }
            
            console.log('Station deleted successfully');
            res.json({ message: 'Station deleted successfully' });
        });
    });
});

// ======================
// BUS ROUTES
// ======================

// GET all buses
app.get('/api/buses', (req, res) => {
    const query = 'SELECT * FROM Bus ORDER BY BusNumber';
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching buses:', err);
            return res.status(500).json({ error: 'Failed to fetch buses' });
        }
        res.json(results);
    });
});

// GET single bus by bus number
app.get('/api/buses/:busNumber', (req, res) => {
    const { busNumber } = req.params;
    const query = 'SELECT * FROM Bus WHERE BusNumber = ?';
    
    db.query(query, [busNumber], (err, results) => {
        if (err) {
            console.error('Error fetching bus:', err);
            return res.status(500).json({ error: 'Failed to fetch bus' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Bus not found' });
        }
        
        res.json(results[0]);
    });
});

// POST create new bus
app.post('/api/buses', (req, res) => {
    const { busNumber, capacity, type, status } = req.body;
    
    // Validation
    if (!busNumber || !capacity || !type || !status) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check valid types
    const validTypes = ['AC', 'Non-AC', 'Sleeper', 'Luxury'];
    const validStatuses = ['Active', 'Under Maintenance', 'Out of Service'];
    
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid bus type' });
    }
    
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    
    if (capacity <= 0) {
        return res.status(400).json({ error: 'Capacity must be greater than 0' });
    }
    
    const query = 'INSERT INTO Bus (BusNumber, Capacity, Type, Status) VALUES (?, ?, ?, ?)';
    
    db.query(query, [busNumber, capacity, type, status], (err, result) => {
        if (err) {
            console.error('Error creating bus:', err);
            
            // Handle duplicate bus number
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Bus number already exists' });
            }
            
            return res.status(500).json({ error: 'Failed to create bus' });
        }
        
        res.status(201).json({
            message: 'Bus created successfully',
            busId: result.insertId,
            busNumber: busNumber
        });
    });
});

// PUT update bus
app.put('/api/buses/:busNumber', (req, res) => {
    const { busNumber } = req.params;
    const { capacity, type, status } = req.body;
    
    // Validation
    if (!capacity || !type || !status) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check valid types
    const validTypes = ['AC', 'Non-AC', 'Sleeper', 'Luxury'];
    const validStatuses = ['Active', 'Under Maintenance', 'Out of Service'];
    
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid bus type' });
    }
    
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    
    if (capacity <= 0) {
        return res.status(400).json({ error: 'Capacity must be greater than 0' });
    }
    
    const query = 'UPDATE Bus SET Capacity = ?, Type = ?, Status = ? WHERE BusNumber = ?';
    
    db.query(query, [capacity, type, status, busNumber], (err, result) => {
        if (err) {
            console.error('Error updating bus:', err);
            return res.status(500).json({ error: 'Failed to update bus' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Bus not found' });
        }
        
        res.json({ message: 'Bus updated successfully' });
    });
});

// DELETE bus
app.delete('/api/buses/:busNumber', (req, res) => {
    const { busNumber } = req.params;
    
    // First check if bus exists
    const checkQuery = 'SELECT BusID FROM Bus WHERE BusNumber = ?';
    
    db.query(checkQuery, [busNumber], (err, results) => {
        if (err) {
            console.error('Error checking bus:', err);
            return res.status(500).json({ error: 'Failed to check bus' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Bus not found' });
        }
        
        const busId = results[0].BusID;
        
        // Check for dependencies (optional)
        const dependencyQueries = [
            'SELECT COUNT(*) as count FROM BusSchedule WHERE BusID = ?',
            'SELECT COUNT(*) as count FROM Ticket WHERE BusID = ?',
            'SELECT COUNT(*) as count FROM BusSeat WHERE BusID = ?'
        ];
        
        let dependencyCount = 0;
        let completedChecks = 0;
        
        dependencyQueries.forEach(query => {
            db.query(query, [busId], (err, result) => {
                if (err) {
                    console.error('Error checking dependencies:', err);
                    return res.status(500).json({ error: 'Failed to check dependencies' });
                }
                
                dependencyCount += result[0].count;
                completedChecks++;
                
                if (completedChecks === dependencyQueries.length) {
                    if (dependencyCount > 0) {
                        return res.status(409).json({ 
                            error: 'Cannot delete bus with existing schedules, tickets, or seats' 
                        });
                    }
                    
                    // Delete the bus
                    const deleteQuery = 'DELETE FROM Bus WHERE BusNumber = ?';
                    db.query(deleteQuery, [busNumber], (err, result) => {
                        if (err) {
                            console.error('Error deleting bus:', err);
                            return res.status(500).json({ error: 'Failed to delete bus' });
                        }
                        
                        res.json({ message: 'Bus deleted successfully' });
                    });
                }
            });
        });
    });
});

// ======================
// BUS SCHEDULE ROUTES
// ======================

// GET all schedules with bus and station details
app.get('/api/schedules', (req, res) => {
    console.log('GET /api/schedules - Fetching all schedules');
    
    const query = `
        SELECT 
            bs.ScheduleID,
            bs.BusID,
            bs.StartStationID,
            bs.EndStationID,
            bs.DepartureTime,
            bs.ArrivalTime,
            bs.Date,
            b.BusNumber,
            b.Type as BusType,
            s1.Name as StartStationName,
            s1.Code as StartStationCode,
            s2.Name as EndStationName,
            s2.Code as EndStationCode
        FROM BusSchedule bs
        JOIN Bus b ON bs.BusID = b.BusID
        JOIN Station s1 ON bs.StartStationID = s1.StationID
        JOIN Station s2 ON bs.EndStationID = s2.StationID
        ORDER BY bs.Date DESC, bs.DepartureTime ASC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching schedules:', err);
            return res.status(500).json({ error: 'Failed to fetch schedules' });
        }
        console.log(`Found ${results.length} schedules`);
        res.json(results);
    });
});

// GET single schedule by ID
app.get('/api/schedules/:id', (req, res) => {
    console.log('GET /api/schedules/:id - Fetching schedule:', req.params.id);
    
    const { id } = req.params;
    const query = `
        SELECT 
            bs.ScheduleID,
            bs.BusID,
            bs.StartStationID,
            bs.EndStationID,
            bs.DepartureTime,
            bs.ArrivalTime,
            bs.Date,
            b.BusNumber,
            b.Type as BusType,
            s1.Name as StartStationName,
            s1.Code as StartStationCode,
            s2.Name as EndStationName,
            s2.Code as EndStationCode
        FROM BusSchedule bs
        JOIN Bus b ON bs.BusID = b.BusID
        JOIN Station s1 ON bs.StartStationID = s1.StationID
        JOIN Station s2 ON bs.EndStationID = s2.StationID
        WHERE bs.ScheduleID = ?
    `;
    
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error fetching schedule:', err);
            return res.status(500).json({ error: 'Failed to fetch schedule' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        
        res.json(results[0]);
    });
});

// POST create new schedule
app.post('/api/schedules', (req, res) => {
    console.log('POST /api/schedules - Creating new schedule:', req.body);
    
    const { busId, startStationId, endStationId, departureTime, arrivalTime, date } = req.body;
    
    // Validate required fields
    if (!busId || !startStationId || !endStationId || !departureTime || !arrivalTime || !date) {
        console.log('Validation failed: Missing required fields');
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate that start and end stations are different
    if (startStationId === endStationId) {
        console.log('Validation failed: Start and end stations cannot be the same');
        return res.status(400).json({ error: 'Start and end stations must be different' });
    }
    
    // Validate that arrival time is after departure time
    if (departureTime >= arrivalTime) {
        console.log('Validation failed: Invalid time sequence');
        return res.status(400).json({ error: 'Arrival time must be after departure time' });
    }
    
    // Check if bus exists and is active
    const busCheckQuery = 'SELECT BusID, Status FROM Bus WHERE BusID = ?';
    db.query(busCheckQuery, [busId], (err, busResults) => {
        if (err) {
            console.error('Error checking bus:', err);
            return res.status(500).json({ error: 'Failed to validate bus' });
        }
        
        if (busResults.length === 0) {
            return res.status(400).json({ error: 'Bus not found' });
        }
        
        if (busResults[0].Status !== 'Active') {
            return res.status(400).json({ error: 'Bus is not active' });
        }
        
        // Check for conflicting schedules (same bus, same date, overlapping times)
        const conflictQuery = `
            SELECT ScheduleID FROM BusSchedule 
            WHERE BusID = ? AND Date = ? 
            AND (
                (DepartureTime <= ? AND ArrivalTime > ?) OR
                (DepartureTime < ? AND ArrivalTime >= ?) OR
                (DepartureTime >= ? AND ArrivalTime <= ?)
            )
        `;
        
        db.query(conflictQuery, [busId, date, departureTime, departureTime, arrivalTime, arrivalTime, departureTime, arrivalTime], (err, conflictResults) => {
            if (err) {
                console.error('Error checking schedule conflicts:', err);
                return res.status(500).json({ error: 'Failed to check schedule conflicts' });
            }
            
            if (conflictResults.length > 0) {
                return res.status(400).json({ error: 'Bus already has a conflicting schedule at this time' });
            }
            
            // Insert the new schedule
            const insertQuery = 'INSERT INTO BusSchedule (BusID, StartStationID, EndStationID, DepartureTime, ArrivalTime, Date) VALUES (?, ?, ?, ?, ?, ?)';
            
            db.query(insertQuery, [busId, startStationId, endStationId, departureTime, arrivalTime, date], (err, result) => {
                if (err) {
                    console.error('Error creating schedule:', err);
                    return res.status(500).json({ error: 'Failed to create schedule' });
                }
                
                console.log('Schedule created successfully with ID:', result.insertId);
                res.status(201).json({ 
                    message: 'Schedule created successfully', 
                    scheduleId: result.insertId 
                });
            });
        });
    });
});

// PUT update schedule
app.put('/api/schedules/:id', (req, res) => {
    console.log('PUT /api/schedules/:id - Updating schedule:', req.params.id, req.body);
    
    const { id } = req.params;
    const { busId, startStationId, endStationId, departureTime, arrivalTime, date } = req.body;
    
    // Validate required fields
    if (!busId || !startStationId || !endStationId || !departureTime || !arrivalTime || !date) {
        console.log('Validation failed: Missing required fields');
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate that start and end stations are different
    if (startStationId === endStationId) {
        console.log('Validation failed: Start and end stations cannot be the same');
        return res.status(400).json({ error: 'Start and end stations must be different' });
    }
    
    // Validate that arrival time is after departure time
    if (departureTime >= arrivalTime) {
        console.log('Validation failed: Invalid time sequence');
        return res.status(400).json({ error: 'Arrival time must be after departure time' });
    }
    
    // Check if schedule exists
    const checkQuery = 'SELECT ScheduleID FROM BusSchedule WHERE ScheduleID = ?';
    db.query(checkQuery, [id], (err, checkResults) => {
        if (err) {
            console.error('Error checking schedule:', err);
            return res.status(500).json({ error: 'Failed to check schedule' });
        }
        
        if (checkResults.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        
        // Check for conflicting schedules (excluding current schedule)
        const conflictQuery = `
            SELECT ScheduleID FROM BusSchedule 
            WHERE BusID = ? AND Date = ? AND ScheduleID != ?
            AND (
                (DepartureTime <= ? AND ArrivalTime > ?) OR
                (DepartureTime < ? AND ArrivalTime >= ?) OR
                (DepartureTime >= ? AND ArrivalTime <= ?)
            )
        `;
        
        db.query(conflictQuery, [busId, date, id, departureTime, departureTime, arrivalTime, arrivalTime, departureTime, arrivalTime], (err, conflictResults) => {
            if (err) {
                console.error('Error checking schedule conflicts:', err);
                return res.status(500).json({ error: 'Failed to check schedule conflicts' });
            }
            
            if (conflictResults.length > 0) {
                return res.status(400).json({ error: 'Bus already has a conflicting schedule at this time' });
            }
            
            // Update the schedule
            const updateQuery = 'UPDATE BusSchedule SET BusID = ?, StartStationID = ?, EndStationID = ?, DepartureTime = ?, ArrivalTime = ?, Date = ? WHERE ScheduleID = ?';
            
            db.query(updateQuery, [busId, startStationId, endStationId, departureTime, arrivalTime, date, id], (err, result) => {
                if (err) {
                    console.error('Error updating schedule:', err);
                    return res.status(500).json({ error: 'Failed to update schedule' });
                }
                
                console.log('Schedule updated successfully');
                res.json({ message: 'Schedule updated successfully' });
            });
        });
    });
});

// DELETE schedule
app.delete('/api/schedules/:id', (req, res) => {
    console.log('DELETE /api/schedules/:id - Deleting schedule:', req.params.id);
    
    const { id } = req.params;
    
    // Check if schedule has associated tickets
    const ticketCheckQuery = 'SELECT COUNT(*) as count FROM Ticket WHERE ScheduleID = ?';
    
    db.query(ticketCheckQuery, [id], (err, results) => {
        if (err) {
            console.error('Error checking tickets:', err);
            return res.status(500).json({ error: 'Failed to check associated tickets' });
        }
        
        if (results[0].count > 0) {
            console.log('Cannot delete schedule - it has associated tickets');
            return res.status(400).json({ 
                error: 'Cannot delete schedule. It has associated tickets.' 
            });
        }
        
        // Safe to delete
        const deleteQuery = 'DELETE FROM BusSchedule WHERE ScheduleID = ?';
        
        db.query(deleteQuery, [id], (err, result) => {
            if (err) {
                console.error('Error deleting schedule:', err);
                return res.status(500).json({ error: 'Failed to delete schedule' });
            }
            
            if (result.affectedRows === 0) {
                console.log('Schedule not found for deletion');
                return res.status(404).json({ error: 'Schedule not found' });
            }
            
            console.log('Schedule deleted successfully');
            res.json({ message: 'Schedule deleted successfully' });
        });
    });
});


// ======================
// BUS SEAT ROUTES
// ======================

// GET all bus seats with bus information
app.get('/api/bus-seats', (req, res) => {
    console.log('GET /api/bus-seats - Fetching all bus seats');
    
    const query = `
        SELECT 
            bs.SeatID,
            bs.BusID,
            bs.SeatNumber,
            bs.Status,
            b.BusNumber,
            b.Type as BusType
        FROM BusSeat bs
        JOIN Bus b ON bs.BusID = b.BusID 
        ORDER BY b.BusNumber, bs.SeatNumber
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching bus seats:', err);
            return res.status(500).json({ error: 'Failed to fetch bus seats' });
        }
        console.log(`Found ${results.length} bus seats`);
        res.json(results);
    });
});

// GET seats for specific bus
app.get('/api/bus-seats/bus/:busId', (req, res) => {
    console.log('GET /api/bus-seats/bus/:busId - Fetching seats for bus:', req.params.busId);
    
    const { busId } = req.params;
    const query = 'SELECT * FROM BusSeat WHERE BusID = ? ORDER BY SeatNumber';
    
    db.query(query, [busId], (err, results) => {
        if (err) {
            console.error('Error fetching bus seats:', err);
            return res.status(500).json({ error: 'Failed to fetch bus seats' });
        }
        console.log(`Found ${results.length} seats for bus ID ${busId}`);
        res.json(results);
    });
});

// GET single seat by ID
app.get('/api/bus-seats/:id', (req, res) => {
    console.log('GET /api/bus-seats/:id - Fetching seat:', req.params.id);
    
    const { id } = req.params;
    const query = `
        SELECT 
            bs.SeatID,
            bs.BusID,
            bs.SeatNumber,
            bs.Status,
            b.BusNumber
        FROM BusSeat bs
        JOIN Bus b ON bs.BusID = b.BusID 
        WHERE bs.SeatID = ?
    `;
    
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error fetching seat:', err);
            return res.status(500).json({ error: 'Failed to fetch seat' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Seat not found' });
        }
        
        res.json(results[0]);
    });
});

// POST create new seat
app.post('/api/bus-seats', (req, res) => {
    console.log('POST /api/bus-seats - Creating new seat:', req.body);
    
    const { busId, seatNumber, status } = req.body;
    
    // Validate required fields
    if (!busId || !seatNumber || !status) {
        console.log('Validation failed: Missing required fields');
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate status
    const validStatuses = ['Available', 'Booked', 'Reserved'];
    if (!validStatuses.includes(status)) {
        console.log('Validation failed: Invalid status');
        return res.status(400).json({ error: 'Invalid seat status' });
    }
    
    // Validate seat number length
    if (seatNumber.length > 10) {
        console.log('Validation failed: Seat number too long');
        return res.status(400).json({ error: 'Seat number must be 10 characters or less' });
    }
    
    // Check if bus exists
    const busCheckQuery = 'SELECT BusID FROM Bus WHERE BusID = ?';
    db.query(busCheckQuery, [busId], (err, busResults) => {
        if (err) {
            console.error('Error checking bus:', err);
            return res.status(500).json({ error: 'Failed to validate bus' });
        }
        
        if (busResults.length === 0) {
            return res.status(400).json({ error: 'Bus not found' });
        }
        
        // Check if seat number already exists for this bus
        const seatCheckQuery = 'SELECT SeatID FROM BusSeat WHERE BusID = ? AND SeatNumber = ?';
        db.query(seatCheckQuery, [busId, seatNumber], (err, seatResults) => {
            if (err) {
                console.error('Error checking seat:', err);
                return res.status(500).json({ error: 'Failed to check seat availability' });
            }
            
            if (seatResults.length > 0) {
                return res.status(400).json({ error: 'Seat number already exists for this bus' });
            }
            
            // Insert the new seat
            const insertQuery = 'INSERT INTO BusSeat (BusID, SeatNumber, Status) VALUES (?, ?, ?)';
            
            db.query(insertQuery, [busId, seatNumber, status], (err, result) => {
                if (err) {
                    console.error('Error creating seat:', err);
                    return res.status(500).json({ error: 'Failed to create seat' });
                }
                
                console.log('Seat created successfully with ID:', result.insertId);
                res.status(201).json({ 
                    message: 'Seat created successfully', 
                    seatId: result.insertId 
                });
            });
        });
    });
});

// PUT update seat
app.put('/api/bus-seats/:id', (req, res) => {
    console.log('PUT /api/bus-seats/:id - Updating seat:', req.params.id, req.body);
    
    const { id } = req.params;
    const { seatNumber, status } = req.body;
    
    // Validate required fields
    if (!seatNumber || !status) {
        console.log('Validation failed: Missing required fields');
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate status
    const validStatuses = ['Available', 'Booked', 'Reserved'];
    if (!validStatuses.includes(status)) {
        console.log('Validation failed: Invalid status');
        return res.status(400).json({ error: 'Invalid seat status' });
    }
    
    // Validate seat number length
    if (seatNumber.length > 10) {
        console.log('Validation failed: Seat number too long');
        return res.status(400).json({ error: 'Seat number must be 10 characters or less' });
    }
    
    // Check if seat exists and get its bus ID
    const checkQuery = 'SELECT BusID FROM BusSeat WHERE SeatID = ?';
    db.query(checkQuery, [id], (err, checkResults) => {
        if (err) {
            console.error('Error checking seat:', err);
            return res.status(500).json({ error: 'Failed to check seat' });
        }
        
        if (checkResults.length === 0) {
            return res.status(404).json({ error: 'Seat not found' });
        }
        
        const busId = checkResults[0].BusID;
        
        // Check if another seat with same number exists for this bus (excluding current seat)
        const duplicateQuery = 'SELECT SeatID FROM BusSeat WHERE BusID = ? AND SeatNumber = ? AND SeatID != ?';
        db.query(duplicateQuery, [busId, seatNumber, id], (err, duplicateResults) => {
            if (err) {
                console.error('Error checking duplicate seat:', err);
                return res.status(500).json({ error: 'Failed to check seat availability' });
            }
            
            if (duplicateResults.length > 0) {
                return res.status(400).json({ error: 'Seat number already exists for this bus' });
            }
            
            // Update the seat
            const updateQuery = 'UPDATE BusSeat SET SeatNumber = ?, Status = ? WHERE SeatID = ?';
            
            db.query(updateQuery, [seatNumber, status, id], (err, result) => {
                if (err) {
                    console.error('Error updating seat:', err);
                    return res.status(500).json({ error: 'Failed to update seat' });
                }
                
                console.log('Seat updated successfully');
                res.json({ message: 'Seat updated successfully' });
            });
        });
    });
});

// DELETE seat
app.delete('/api/bus-seats/:id', (req, res) => {
    console.log('DELETE /api/bus-seats/:id - Deleting seat:', req.params.id);
    
    const { id } = req.params;
    
    // Check if seat is referenced in tickets (if you have a ticket system)
    // For now, we'll just delete the seat directly
    const deleteQuery = 'DELETE FROM BusSeat WHERE SeatID = ?';
    
    db.query(deleteQuery, [id], (err, result) => {
        if (err) {
            console.error('Error deleting seat:', err);
            return res.status(500).json({ error: 'Failed to delete seat' });
        }
        
        if (result.affectedRows === 0) {
            console.log('Seat not found for deletion');
            return res.status(404).json({ error: 'Seat not found' });
        }
        
        console.log('Seat deleted successfully');
        res.json({ message: 'Seat deleted successfully' });
    });
});

// POST generate all seats for a bus
app.post('/api/bus-seats/generate', (req, res) => {
    console.log('POST /api/bus-seats/generate - Generating seats for bus:', req.body);
    
    const { busId } = req.body;
    
    if (!busId) {
        return res.status(400).json({ error: 'Bus ID is required' });
    }
    
    // Get bus details
    const busQuery = 'SELECT BusID, BusNumber, Capacity FROM Bus WHERE BusID = ?';
    db.query(busQuery, [busId], (err, busResults) => {
        if (err) {
            console.error('Error fetching bus:', err);
            return res.status(500).json({ error: 'Failed to fetch bus details' });
        }
        
        if (busResults.length === 0) {
            return res.status(404).json({ error: 'Bus not found' });
        }
        
        const bus = busResults[0];
        
        // Check if seats already exist for this bus
        const existingSeatsQuery = 'SELECT COUNT(*) as count FROM BusSeat WHERE BusID = ?';
        db.query(existingSeatsQuery, [busId], (err, countResults) => {
            if (err) {
                console.error('Error checking existing seats:', err);
                return res.status(500).json({ error: 'Failed to check existing seats' });
            }
            
            if (countResults[0].count > 0) {
                return res.status(400).json({ 
                    error: `Bus ${bus.BusNumber} already has ${countResults[0].count} seats. Delete existing seats first or add individual seats.` 
                });
            }
            
            // Generate seats
            const seats = [];
            for (let i = 1; i <= bus.Capacity; i++) {
                seats.push([busId, i.toString(), 'Available']);
            }
            
            const insertQuery = 'INSERT INTO BusSeat (BusID, SeatNumber, Status) VALUES ?';
            
            db.query(insertQuery, [seats], (err, result) => {
                if (err) {
                    console.error('Error generating seats:', err);
                    return res.status(500).json({ error: 'Failed to generate seats' });
                }
                
                console.log(`Generated ${bus.Capacity} seats for bus ${bus.BusNumber}`);
                res.status(201).json({ 
                    message: `Successfully generated ${bus.Capacity} seats for bus ${bus.BusNumber}`,
                    count: bus.Capacity,
                    busNumber: bus.BusNumber
                });
            });
        });
    });
});

// ======================
// PASSENGER ROUTES
// ======================

// GET all passengers
app.get('/api/passengers', (req, res) => {
    console.log('GET /api/passengers - Fetching all passengers');
    const query = 'SELECT * FROM Passenger ORDER BY Name';
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching passengers:', err);
            return res.status(500).json({ error: 'Failed to fetch passengers' });
        }
        console.log(`Found ${results.length} passengers`);
        res.json(results);
    });
});

// GET single passenger by ID
app.get('/api/passengers/:id', (req, res) => {
    console.log('GET /api/passengers/:id - Fetching passenger:', req.params.id);
    
    const { id } = req.params;
    const query = 'SELECT * FROM Passenger WHERE PassengerID = ?';
    
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error fetching passenger:', err);
            return res.status(500).json({ error: 'Failed to fetch passenger' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Passenger not found' });
        }
        
        res.json(results[0]);
    });
});

// POST create new passenger
app.post('/api/passengers', (req, res) => {
    console.log('POST /api/passengers - Creating new passenger:', req.body);
    
    const { Name, Age, Contact } = req.body;
    
    // Validate required fields
    if (!Name || !Age || !Contact) {
        console.log('Validation failed: Missing required fields');
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate Age > 0 (matches MySQL CHECK constraint)
    if (Age <= 0) {
        console.log('Validation failed: Age must be greater than 0');
        return res.status(400).json({ error: 'Age must be greater than 0' });
    }
    
    // Validate Age is reasonable
    if (Age > 120) {
        console.log('Validation failed: Age too high');
        return res.status(400).json({ error: 'Please enter a valid age' });
    }
    
    // Validate Name length (matches MySQL VARCHAR(100))
    if (Name.length > 100) {
        console.log('Validation failed: Name too long');
        return res.status(400).json({ error: 'Name cannot exceed 100 characters' });
    }
    
    // Validate Contact length (matches MySQL VARCHAR(15))
    if (Contact.length > 15) {
        console.log('Validation failed: Contact too long');
        return res.status(400).json({ error: 'Contact number cannot exceed 15 characters' });
    }
    
    // Validate Contact contains only numbers
    if (!/^\d+$/.test(Contact)) {
        console.log('Validation failed: Contact must contain only numbers');
        return res.status(400).json({ error: 'Contact number must contain only digits' });
    }
    
    // Validate Contact minimum length
    if (Contact.length < 10) {
        console.log('Validation failed: Contact too short');
        return res.status(400).json({ error: 'Contact number should be at least 10 digits' });
    }
    
    const query = 'INSERT INTO Passenger (Name, Age, Contact) VALUES (?, ?, ?)';
    
    db.query(query, [Name, Age, Contact], (err, result) => {
        if (err) {
            console.error('Error creating passenger:', err);
            
            // Handle unique constraint violation for contact (if Contact has UNIQUE constraint)
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Duplicate entry - Contact number already exists' });
            }
            
            return res.status(500).json({ error: 'Failed to create passenger' });
        }
        
        console.log('Passenger created successfully with ID:', result.insertId);
        res.status(201).json({ 
            message: 'Passenger created successfully', 
            passengerId: result.insertId 
        });
    });
});

// PUT update passenger
app.put('/api/passengers/:id', (req, res) => {
    console.log('PUT /api/passengers/:id - Updating passenger:', req.params.id, req.body);
    
    const { id } = req.params;
    const { Name, Age, Contact } = req.body;
    
    // Validate required fields
    if (!Name || !Age || !Contact) {
        console.log('Validation failed: Missing required fields');
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate Age > 0 (matches MySQL CHECK constraint)
    if (Age <= 0) {
        console.log('Validation failed: Age must be greater than 0');
        return res.status(400).json({ error: 'Age must be greater than 0' });
    }
    
    // Validate Age is reasonable
    if (Age > 120) {
        console.log('Validation failed: Age too high');
        return res.status(400).json({ error: 'Please enter a valid age' });
    }
    
    // Validate Name length (matches MySQL VARCHAR(100))
    if (Name.length > 100) {
        console.log('Validation failed: Name too long');
        return res.status(400).json({ error: 'Name cannot exceed 100 characters' });
    }
    
    // Validate Contact length (matches MySQL VARCHAR(15))
    if (Contact.length > 15) {
        console.log('Validation failed: Contact too long');
        return res.status(400).json({ error: 'Contact number cannot exceed 15 characters' });
    }
    
    // Validate Contact contains only numbers
    if (!/^\d+$/.test(Contact)) {
        console.log('Validation failed: Contact must contain only numbers');
        return res.status(400).json({ error: 'Contact number must contain only digits' });
    }
    
    // Validate Contact minimum length
    if (Contact.length < 10) {
        console.log('Validation failed: Contact too short');
        return res.status(400).json({ error: 'Contact number should be at least 10 digits' });
    }
    
    const query = 'UPDATE Passenger SET Name = ?, Age = ?, Contact = ? WHERE PassengerID = ?';
    
    db.query(query, [Name, Age, Contact, id], (err, result) => {
        if (err) {
            console.error('Error updating passenger:', err);
            
            // Handle unique constraint violation for contact (if Contact has UNIQUE constraint)
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Duplicate entry - Contact number already exists' });
            }
            
            return res.status(500).json({ error: 'Failed to update passenger' });
        }
        
        if (result.affectedRows === 0) {
            console.log('Passenger not found for update');
            return res.status(404).json({ error: 'Passenger not found' });
        }
        
        console.log('Passenger updated successfully');
        res.json({ message: 'Passenger updated successfully' });
    });
});

// DELETE passenger
app.delete('/api/passengers/:id', (req, res) => {
    console.log('DELETE /api/passengers/:id - Deleting passenger:', req.params.id);
    
    const { id } = req.params;
    
    // First check if passenger has associated tickets (if you have ticket system)
    // For now, we'll check if passenger is referenced in any tickets
    const ticketCheckQuery = 'SELECT COUNT(*) as count FROM Ticket WHERE PassengerID = ?';
    
    db.query(ticketCheckQuery, [id], (err, results) => {
        if (err) {
            // If Ticket table doesn't exist yet, just proceed with deletion
            if (err.code === 'ER_NO_SUCH_TABLE') {
                console.log('Ticket table not found, proceeding with passenger deletion');
                proceedWithDeletion();
                return;
            }
            
            console.error('Error checking passenger tickets:', err);
            return res.status(500).json({ error: 'Failed to check associated tickets' });
        }
        
        if (results[0].count > 0) {
            console.log('Cannot delete passenger - has associated tickets');
            return res.status(400).json({ 
                error: 'Cannot delete passenger. They have associated tickets.' 
            });
        }
        
        proceedWithDeletion();
    });
    
    function proceedWithDeletion() {
        const deleteQuery = 'DELETE FROM Passenger WHERE PassengerID = ?';
        
        db.query(deleteQuery, [id], (err, result) => {
            if (err) {
                console.error('Error deleting passenger:', err);
                return res.status(500).json({ error: 'Failed to delete passenger' });
            }
            
            if (result.affectedRows === 0) {
                console.log('Passenger not found for deletion');
                return res.status(404).json({ error: 'Passenger not found' });
            }
            
            console.log('Passenger deleted successfully');
            res.json({ message: 'Passenger deleted successfully' });
        });
    }
});

// ======================
// TICKET ROUTES
// ======================

// GET all tickets with detailed information
app.get('/api/tickets', (req, res) => {
    console.log('GET /api/tickets - Fetching all tickets');
    
    const query = `
        SELECT 
            t.TicketID,
            t.PassengerID,
            t.BusID,
            t.ScheduleID,
            t.Price,
            t.BookingDate,
            t.PaymentMethod,
            p.Name as PassengerName,
            p.Contact as PassengerContact,
            b.BusNumber,
            b.Type as BusType,
            bs.Date as ScheduleDate,
            CONCAT(bs.DepartureTime, ' - ', bs.ArrivalTime) as ScheduleTime,
            CONCAT(s1.Name, ' to ', s2.Name) as Route
        FROM Ticket t
        JOIN Passenger p ON t.PassengerID = p.PassengerID
        JOIN Bus b ON t.BusID = b.BusID
        JOIN BusSchedule bs ON t.ScheduleID = bs.ScheduleID
        JOIN Station s1 ON bs.StartStationID = s1.StationID
        JOIN Station s2 ON bs.EndStationID = s2.StationID
        ORDER BY t.BookingDate DESC, t.TicketID DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching tickets:', err);
            return res.status(500).json({ error: 'Failed to fetch tickets' });
        }
        console.log(`Found ${results.length} tickets`);
        res.json(results);
    });
});

// GET single ticket by ID
app.get('/api/tickets/:id', (req, res) => {
    console.log('GET /api/tickets/:id - Fetching ticket:', req.params.id);
    
    const { id } = req.params;
    const query = `
        SELECT 
            t.TicketID,
            t.PassengerID,
            t.BusID,
            t.ScheduleID,
            t.Price,
            t.BookingDate,
            t.PaymentMethod,
            p.Name as PassengerName,
            p.Contact as PassengerContact,
            b.BusNumber,
            b.Type as BusType,
            bs.Date as ScheduleDate,
            CONCAT(bs.DepartureTime, ' - ', bs.ArrivalTime) as ScheduleTime,
            CONCAT(s1.Name, ' to ', s2.Name) as Route
        FROM Ticket t
        JOIN Passenger p ON t.PassengerID = p.PassengerID
        JOIN Bus b ON t.BusID = b.BusID
        JOIN BusSchedule bs ON t.ScheduleID = bs.ScheduleID
        JOIN Station s1 ON bs.StartStationID = s1.StationID
        JOIN Station s2 ON bs.EndStationID = s2.StationID
        WHERE t.TicketID = ?
    `;
    
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error fetching ticket:', err);
            return res.status(500).json({ error: 'Failed to fetch ticket' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        res.json(results[0]);
    });
});

// POST create new ticket
app.post('/api/tickets', (req, res) => {
    console.log('POST /api/tickets - Creating new ticket:', req.body);
    
    const { ticketId, passengerId, busId, scheduleId, price, bookingDate, paymentMethod } = req.body;
    
    // Validate required fields
    if (!ticketId || !passengerId || !busId || !scheduleId || !price || !bookingDate || !paymentMethod) {
        console.log('Validation failed: Missing required fields');
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate price
    if (price <= 0) {
        console.log('Validation failed: Invalid price');
        return res.status(400).json({ error: 'Price must be greater than 0' });
    }
    
    // Validate payment method
    const validPaymentMethods = ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking'];
    if (!validPaymentMethods.includes(paymentMethod)) {
        console.log('Validation failed: Invalid payment method');
        return res.status(400).json({ error: 'Invalid payment method' });
    }
    
    // Validate booking date (should not be in the past)
    const today = new Date();
    const bookingDateObj = new Date(bookingDate);
    if (bookingDateObj < today.setHours(0, 0, 0, 0)) {
        console.log('Validation failed: Booking date in the past');
        return res.status(400).json({ error: 'Booking date cannot be in the past' });
    }
    
    // Check if ticket ID already exists
    const ticketCheckQuery = 'SELECT TicketID FROM Ticket WHERE TicketID = ?';
    db.query(ticketCheckQuery, [ticketId], (err, ticketResults) => {
        if (err) {
            console.error('Error checking ticket ID:', err);
            return res.status(500).json({ error: 'Failed to validate ticket ID' });
        }
        
        if (ticketResults.length > 0) {
            return res.status(400).json({ error: 'Ticket ID already exists' });
        }
        
        // Check if passenger exists
        const passengerCheckQuery = 'SELECT PassengerID FROM Passenger WHERE PassengerID = ?';
        db.query(passengerCheckQuery, [passengerId], (err, passengerResults) => {
            if (err) {
                console.error('Error checking passenger:', err);
                return res.status(500).json({ error: 'Failed to validate passenger' });
            }
            
            if (passengerResults.length === 0) {
                return res.status(400).json({ error: 'Passenger not found' });
            }
            
            // Check if bus exists and is active
            const busCheckQuery = 'SELECT BusID, Status FROM Bus WHERE BusID = ?';
            db.query(busCheckQuery, [busId], (err, busResults) => {
                if (err) {
                    console.error('Error checking bus:', err);
                    return res.status(500).json({ error: 'Failed to validate bus' });
                }
                
                if (busResults.length === 0) {
                    return res.status(400).json({ error: 'Bus not found' });
                }
                
                if (busResults[0].Status !== 'Active') {
                    return res.status(400).json({ error: 'Bus is not active' });
                }
                
                // Check if schedule exists and belongs to the bus
                const scheduleCheckQuery = 'SELECT ScheduleID, BusID, Date FROM BusSchedule WHERE ScheduleID = ? AND BusID = ?';
                db.query(scheduleCheckQuery, [scheduleId, busId], (err, scheduleResults) => {
                    if (err) {
                        console.error('Error checking schedule:', err);
                        return res.status(500).json({ error: 'Failed to validate schedule' });
                    }
                    
                    if (scheduleResults.length === 0) {
                        return res.status(400).json({ error: 'Schedule not found or does not match the selected bus' });
                    }
                    
                    // Insert the new ticket
                    const insertQuery = 'INSERT INTO Ticket (TicketID, PassengerID, BusID, ScheduleID, Price, BookingDate, PaymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?)';
                    
                    db.query(insertQuery, [ticketId, passengerId, busId, scheduleId, price, bookingDate, paymentMethod], (err, result) => {
                        if (err) {
                            console.error('Error creating ticket:', err);
                            
                            if (err.code === 'ER_DUP_ENTRY') {
                                return res.status(409).json({ error: 'Ticket ID already exists' });
                            }
                            
                            return res.status(500).json({ error: 'Failed to create ticket' });
                        }
                        
                        console.log('Ticket created successfully with ID:', ticketId);
                        res.status(201).json({ 
                            message: 'Ticket booked successfully', 
                            ticketId: ticketId 
                        });
                    });
                });
            });
        });
    });
});

// PUT update ticket
app.put('/api/tickets/:id', (req, res) => {
    console.log('PUT /api/tickets/:id - Updating ticket:', req.params.id, req.body);
    
    const { id } = req.params;
    const { passengerId, busId, scheduleId, price, bookingDate, paymentMethod } = req.body;
    
    // Validate required fields
    if (!passengerId || !busId || !scheduleId || !price || !bookingDate || !paymentMethod) {
        console.log('Validation failed: Missing required fields');
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate price
    if (price <= 0) {
        console.log('Validation failed: Invalid price');
        return res.status(400).json({ error: 'Price must be greater than 0' });
    }
    
    // Validate payment method
    const validPaymentMethods = ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking'];
    if (!validPaymentMethods.includes(paymentMethod)) {
        console.log('Validation failed: Invalid payment method');
        return res.status(400).json({ error: 'Invalid payment method' });
    }
    
    // Check if ticket exists
    const checkQuery = 'SELECT TicketID FROM Ticket WHERE TicketID = ?';
    db.query(checkQuery, [id], (err, checkResults) => {
        if (err) {
            console.error('Error checking ticket:', err);
            return res.status(500).json({ error: 'Failed to check ticket' });
        }
        
        if (checkResults.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        // Check if passenger exists
        const passengerCheckQuery = 'SELECT PassengerID FROM Passenger WHERE PassengerID = ?';
        db.query(passengerCheckQuery, [passengerId], (err, passengerResults) => {
            if (err) {
                console.error('Error checking passenger:', err);
                return res.status(500).json({ error: 'Failed to validate passenger' });
            }
            
            if (passengerResults.length === 0) {
                return res.status(400).json({ error: 'Passenger not found' });
            }
            
            // Check if schedule exists and belongs to the bus
            const scheduleCheckQuery = 'SELECT ScheduleID, BusID FROM BusSchedule WHERE ScheduleID = ? AND BusID = ?';
            db.query(scheduleCheckQuery, [scheduleId, busId], (err, scheduleResults) => {
                if (err) {
                    console.error('Error checking schedule:', err);
                    return res.status(500).json({ error: 'Failed to validate schedule' });
                }
                
                if (scheduleResults.length === 0) {
                    return res.status(400).json({ error: 'Schedule not found or does not match the selected bus' });
                }
                
                // Update the ticket
                const updateQuery = 'UPDATE Ticket SET PassengerID = ?, BusID = ?, ScheduleID = ?, Price = ?, BookingDate = ?, PaymentMethod = ? WHERE TicketID = ?';
                
                db.query(updateQuery, [passengerId, busId, scheduleId, price, bookingDate, paymentMethod, id], (err, result) => {
                    if (err) {
                        console.error('Error updating ticket:', err);
                        return res.status(500).json({ error: 'Failed to update ticket' });
                    }
                    
                    console.log('Ticket updated successfully');
                    res.json({ message: 'Ticket updated successfully' });
                });
            });
        });
    });
});

// DELETE ticket
app.delete('/api/tickets/:id', (req, res) => {
    console.log('DELETE /api/tickets/:id - Deleting ticket:', req.params.id);
    
    const { id } = req.params;
    
    // Check if ticket exists
    const checkQuery = 'SELECT TicketID FROM Ticket WHERE TicketID = ?';
    db.query(checkQuery, [id], (err, checkResults) => {
        if (err) {
            console.error('Error checking ticket:', err);
            return res.status(500).json({ error: 'Failed to check ticket' });
        }
        
        if (checkResults.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        // Check if ticket has associated payments
        const paymentCheckQuery = 'SELECT COUNT(*) as count FROM Payment WHERE TicketID = ?';
        db.query(paymentCheckQuery, [id], (err, paymentResults) => {
            if (err) {
                // If Payment table doesn't exist, proceed with deletion
                if (err.code === 'ER_NO_SUCH_TABLE') {
                    console.log('Payment table not found, proceeding with ticket deletion');
                    proceedWithDeletion();
                    return;
                }
                
                console.error('Error checking payments:', err);
                return res.status(500).json({ error: 'Failed to check associated payments' });
            }
            
            if (paymentResults[0].count > 0) {
                console.log('Cannot delete ticket - has associated payments');
                return res.status(400).json({ 
                    error: 'Cannot delete ticket. It has associated payment records.' 
                });
            }
            
            proceedWithDeletion();
        });
        
        function proceedWithDeletion() {
            const deleteQuery = 'DELETE FROM Ticket WHERE TicketID = ?';
            
            db.query(deleteQuery, [id], (err, result) => {
                if (err) {
                    console.error('Error deleting ticket:', err);
                    return res.status(500).json({ error: 'Failed to delete ticket' });
                }
                
                console.log('Ticket deleted successfully');
                res.json({ message: 'Ticket deleted successfully' });
            });
        }
    });
});

// GET tickets by passenger ID
app.get('/api/tickets/passenger/:passengerId', (req, res) => {
    console.log('GET /api/tickets/passenger/:passengerId - Fetching tickets for passenger:', req.params.passengerId);
    
    const { passengerId } = req.params;
    const query = `
        SELECT 
            t.TicketID,
            t.PassengerID,
            t.BusID,
            t.ScheduleID,
            t.Price,
            t.BookingDate,
            t.PaymentMethod,
            p.Name as PassengerName,
            b.BusNumber,
            bs.Date as ScheduleDate,
            CONCAT(bs.DepartureTime, ' - ', bs.ArrivalTime) as ScheduleTime,
            CONCAT(s1.Name, ' to ', s2.Name) as Route
        FROM Ticket t
        JOIN Passenger p ON t.PassengerID = p.PassengerID
        JOIN Bus b ON t.BusID = b.BusID
        JOIN BusSchedule bs ON t.ScheduleID = bs.ScheduleID
        JOIN Station s1 ON bs.StartStationID = s1.StationID
        JOIN Station s2 ON bs.EndStationID = s2.StationID
        WHERE t.PassengerID = ?
        ORDER BY t.BookingDate DESC
    `;
    
    db.query(query, [passengerId], (err, results) => {
        if (err) {
            console.error('Error fetching passenger tickets:', err);
            return res.status(500).json({ error: 'Failed to fetch passenger tickets' });
        }
        
        console.log(`Found ${results.length} tickets for passenger ${passengerId}`);
        res.json(results);
    });
});

// GET tickets by schedule ID
app.get('/api/tickets/schedule/:scheduleId', (req, res) => {
    console.log('GET /api/tickets/schedule/:scheduleId - Fetching tickets for schedule:', req.params.scheduleId);
    
    const { scheduleId } = req.params;
    const query = `
        SELECT 
            t.TicketID,
            t.PassengerID,
            t.Price,
            t.BookingDate,
            t.PaymentMethod,
            p.Name as PassengerName,
            p.Contact as PassengerContact
        FROM Ticket t
        JOIN Passenger p ON t.PassengerID = p.PassengerID
        WHERE t.ScheduleID = ?
        ORDER BY t.BookingDate DESC
    `;
    
    db.query(query, [scheduleId], (err, results) => {
        if (err) {
            console.error('Error fetching schedule tickets:', err);
            return res.status(500).json({ error: 'Failed to fetch schedule tickets' });
        }
        
        console.log(`Found ${results.length} tickets for schedule ${scheduleId}`);
        res.json(results);
    });
});

// GET ticket statistics
app.get('/api/tickets/stats', (req, res) => {
    console.log('GET /api/tickets/stats - Fetching ticket statistics');
    
    const statsQuery = `
        SELECT 
            COUNT(*) as totalTickets,
            SUM(Price) as totalRevenue,
            AVG(Price) as averagePrice,
            COUNT(DISTINCT PassengerID) as uniquePassengers,
            COUNT(DISTINCT BusID) as activeBuses
        FROM Ticket
    `;
    
    db.query(statsQuery, (err, results) => {
        if (err) {
            console.error('Error fetching ticket statistics:', err);
            return res.status(500).json({ error: 'Failed to fetch ticket statistics' });
        }
        
        const stats = results[0];
        console.log('Ticket statistics fetched successfully');
        res.json({
            totalTickets: stats.totalTickets || 0,
            totalRevenue: parseFloat(stats.totalRevenue || 0).toFixed(2),
            averagePrice: parseFloat(stats.averagePrice || 0).toFixed(2),
            uniquePassengers: stats.uniquePassengers || 0,
            activeBuses: stats.activeBuses || 0
        });
    });
});

// ===============================
app.get('/staff', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Staff');
    res.json(rows);
  } catch (err) {
    console.error('Error loading staff:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET all staff
app.get('/api/staff', (req, res) => {
  const query = `
    SELECT s.StaffID, s.Name, s.Role, s.Contact, s.AssignedBusID, b.BusNumber
    FROM Staff s
    LEFT JOIN Buses b ON s.AssignedBusID = b.BusID
    ORDER BY s.StaffID DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch staff' });
    res.json(results);
  });
});

// ===============================
// POST new staff
app.post('/api/staff', (req, res) => {
  const { Name, Role, Contact, AssignedBusID } = req.body;
  const query = `INSERT INTO Staff (Name, Role, Contact, AssignedBusID) VALUES (?, ?, ?, ?)`;
  db.query(query, [Name, Role, Contact, AssignedBusID || null], (err, result) => {
    if (err) return res.status(500).json({ error: 'Failed to add staff member' });
    res.json({ message: 'Staff member added', id: result.insertId });
  });
});

// ===============================
// PUT (update) staff
app.put('/api/staff/:id', (req, res) => {
  const staffId = req.params.id;
  const { Name, Role, Contact, AssignedBusID } = req.body;
  const query = `
    UPDATE Staff
    SET Name = ?, Role = ?, Contact = ?, AssignedBusID = ?
    WHERE StaffID = ?
  `;
  db.query(query, [Name, Role, Contact, AssignedBusID || null, staffId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Failed to update staff member' });
    res.json({ message: 'Staff member updated' });
  });
});

// ===============================
// DELETE staff
app.delete('/api/staff/:id', (req, res) => {
  const staffId = req.params.id;
  const query = `DELETE FROM Staff WHERE StaffID = ?`;
  db.query(query, [staffId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Failed to delete staff member' });
    res.json({ message: 'Staff member deleted' });
  });
});

// ===============================
// GET all buses (for assignment dropdown)
app.get('/api/buses', (req, res) => {
  const query = `SELECT BusID, BusNumber, Type, Status FROM Buses ORDER BY BusID`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch buses' });
    res.json(results);
  });
});


// ======================
// UTILITY ROUTES
// ======================

// Test endpoint
app.get('/api/test', (req, res) => {
    db.query('SELECT 1 as test', (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database connection failed' });
        }
        res.json({ message: 'Database connection successful', result: results[0] });
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Bus Management System API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Define the port and start the server
const PORT = process.env.PORT || 3000;

// Update this section in your server startup
// Update this section in your server startup
app.listen(PORT, () => {
    console.log(`[INFO] Bus Management API running at http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  GET /api/health - Health check');
    console.log('  GET /api/test - Test database connection');
    console.log('  ');
    console.log('  STATION ENDPOINTS:');
    console.log('  GET /api/stations - Get all stations');
    console.log('  POST /api/stations - Create new station');
    console.log('  PUT /api/stations/:id - Update station');
    console.log('  DELETE /api/stations/:id - Delete station');
    console.log('  ');
    console.log('  BUS ENDPOINTS:');
    console.log('  GET /api/buses - Get all buses');
    console.log('  GET /api/buses/:busNumber - Get single bus');
    console.log('  POST /api/buses - Create new bus');
    console.log('  PUT /api/buses/:busNumber - Update bus');
    console.log('  DELETE /api/buses/:busNumber - Delete bus');
    console.log('  ');
    console.log('  SCHEDULE ENDPOINTS:');
    console.log('  GET /api/schedules - Get all schedules');
    console.log('  GET /api/schedules/:id - Get single schedule');
    console.log('  POST /api/schedules - Create new schedule');
    console.log('  PUT /api/schedules/:id - Update schedule');
    console.log('  DELETE /api/schedules/:id - Delete schedule');
    console.log('  ');
    console.log('  BUS SEAT ENDPOINTS:');
    console.log('  GET /api/bus-seats - Get all bus seats');
    console.log('  GET /api/bus-seats/bus/:busId - Get seats for specific bus');
    console.log('  GET /api/bus-seats/:id - Get single seat');
    console.log('  POST /api/bus-seats - Create new seat');
    console.log('  PUT /api/bus-seats/:id - Update seat');
    console.log('  DELETE /api/bus-seats/:id - Delete seat');
    console.log('  POST /api/bus-seats/generate - Generate all seats for a bus');
    console.log('  ');
    console.log('  PASSENGER ENDPOINTS:');
    console.log('  GET /api/passengers - Get all passengers');
    console.log('  GET /api/passengers/:id - Get single passenger');
    console.log('  POST /api/passengers - Create new passenger');
    console.log('  PUT /api/passengers/:id - Update passenger');
    console.log('  DELETE /api/passengers/:id - Delete passenger');
});